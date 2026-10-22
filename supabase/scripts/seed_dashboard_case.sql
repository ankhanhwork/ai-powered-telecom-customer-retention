-- Template for prepared, admin-only batches. No pending delivery, AI or consent writes.
do $seed$
declare p jsonb; v_case uuid; v_customer uuid; v_prediction uuid; v_owner uuid;
 v_conversation uuid; v_message uuid; v_approval uuid; v_outbox uuid;
 e jsonb; v_body text; v_hash text; v_at timestamptz; v_created timestamptz;
 v_result jsonb; v_source_message uuid;
begin
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 for p in select value from jsonb_array_elements(__PAYLOAD__::jsonb) loop
  if exists(select 1 from public.interaction_events where id=(p->>'marker_id')::uuid) then continue; end if;
  v_owner:=(p->>'owner')::uuid; v_created:=(p->>'created_at')::timestamptz;
  if (p->>'historical')::boolean then
   v_result:=public.retention_ingest_prediction(p->'run',p->>'customer',p->'features',p->'prediction',null,p->'profile');
   v_customer:=(v_result->>'customer_id')::uuid; v_prediction:=(v_result->>'prediction_id')::uuid;
   v_case:=(v_result->>'case_id')::uuid;
   if v_case is null then
    v_case:=(p->>'case_id')::uuid;
    insert into public.retention_cases(id,customer_id,prediction_id,target_period_start)
     values(v_case,v_customer,v_prediction,(p->>'start')::date);
   end if;
  else
   select c.id,c.customer_id,c.prediction_id into v_case,v_customer,v_prediction
    from public.retention_cases c join public.customers cu on cu.id=c.customer_id
    where cu.customer_ref=p->>'customer' and c.target_period_start=(p->>'start')::date for update of c;
   if v_case is null then raise exception 'Current case missing'; end if;
   if exists(select 1 from public.messages where case_id=v_case) or
    exists(select 1 from public.automation_jobs where case_id=v_case) or
    exists(select 1 from public.support_requests where case_id=v_case) or
    exists(select 1 from public.retention_cases where id=v_case and assigned_agent_id is not null) then
    raise exception 'Refuse to alter an existing operational fixture';
   end if;
  end if;
  update public.retention_cases set assigned_agent_id=v_owner,case_status=p->>'stage',
   created_at=v_created,updated_at=now(),
   closed_at=case when p->>'stage'='closed' then v_created+interval '7 hours' end,
   close_reason=case when p->>'stage'='closed' then 'care_completed' end,
   contact_result=case when p->>'stage'='new' then 'not_contacted' else 'contacted' end,
   last_contact_at=case when p->>'stage'<>'new' then v_created+interval '2 hours' end
   where id=v_case;
  insert into public.interaction_events(id,case_id,event_type,actor_user_id,occurred_at,metadata)
   values((p->>'marker_id')::uuid,v_case,'care.issue_recorded',v_owner,v_created,
    jsonb_build_object('primary_issue',p->>'primary_issue','seed_version','dashboard-v1','is_simulated',true));
  v_conversation:=(p->>'conversation_id')::uuid;
  insert into public.conversations(id,case_id,customer_id,selected_channel,created_at,status)
   values(v_conversation,v_case,v_customer,'Zalo',v_created,case when p->>'stage'='closed' then 'closed' else 'open' end);
  v_source_message:=null;
  for e in select value from jsonb_array_elements(p->'events') loop
   v_at:=(e->>'at')::timestamptz;
   if e->>'type' in ('sent','reply') then
    v_message:=(e->>'message_id')::uuid;
    v_body:=case when e->>'type'='sent' then 'Hello, I am following up on your Internet service. Is there anything we can help with?'
     else 'Thank you for following up. Please help me review my service and the next steps.' end;
    v_hash:=encode(sha256(convert_to(v_body,'UTF8')),'hex');
    insert into public.messages(id,case_id,conversation_id,sender_type,sender_user_id,direction,visibility,
     current_revision,sent_revision,approval_status,delivery_status,created_at,sent_at)
     values(v_message,v_case,v_conversation,case when e->>'type'='sent' then 'agent' else 'customer' end,
      case when e->>'type'='sent' then v_owner end,case when e->>'type'='sent' then 'outbound' else 'inbound' end,'external',
      1,case when e->>'type'='sent' then 1 end,case when e->>'type'='sent' then 'approved' else 'not_required' end,
      case when e->>'type'='sent' then 'sent' else 'received' end,v_at,case when e->>'type'='sent' then v_at end);
    insert into public.message_revisions(message_id,revision,body,request_key,content_hash,created_by,created_at)
     values(v_message,1,v_body,'dashboard-v1:revision:'||v_message,v_hash,v_owner,v_at-interval '10 minutes');
    if e->>'type'='sent' then
     v_approval:=(e->>'approval_id')::uuid; v_outbox:=(e->>'outbox_id')::uuid;
     insert into public.message_approvals(id,message_id,revision,content_hash,reviewer_id,decision,decided_at)
      values(v_approval,v_message,1,v_hash,v_owner,'approved',v_at-interval '5 minutes');
     insert into public.delivery_outbox(id,message_id,revision,content_hash,approval_id,channel,idempotency_key,
      status,attempt_count,provider_receipt,created_at,sent_at)
      values(v_outbox,v_message,1,v_hash,v_approval,'Zalo','dashboard-v1:delivery:'||v_message,
       'sent',1,'mock:dashboard-v1:'||v_message,v_at-interval '5 minutes',v_at);
     v_source_message:=v_message;
    end if;
    insert into public.interaction_events(id,case_id,message_id,event_type,actor_user_id,occurred_at,channel,metadata)
     values((e->>'id')::uuid,v_case,v_message,case when e->>'type'='sent' then 'message.sent' else 'message.received' end,
      case when e->>'type'='sent' then v_owner end,v_at,'Zalo','{"seed_version":"dashboard-v1","is_simulated":true}');
   elsif e->>'type'<>'approved' then
    insert into public.interaction_events(id,case_id,event_type,actor_user_id,occurred_at,metadata)
     values((e->>'id')::uuid,v_case,case e->>'type' when 'closed' then 'case.closed' when 'assigned' then 'case.assigned'
      when 'delivery_failed' then 'delivery.failed' else e->>'type' end,v_owner,v_at,
      jsonb_build_object('seed_version','dashboard-v1','is_simulated',true,'assigned_agent_id',v_owner));
   end if;
  end loop;
  if p->'task' <> 'null'::jsonb then
   insert into public.follow_up_tasks(id,case_id,source_message_id,task_type,due_at,status,assigned_agent_id,idempotency_key,created_at)
    values((p->'task'->>'id')::uuid,v_case,v_source_message,'manual_reminder',
     (p->'task'->>'due_at')::timestamptz,p->'task'->>'status',v_owner,'dashboard-v1:task:'||v_case,v_created+interval '6 hours');
  end if;
  if p->'ticket' <> 'null'::jsonb then
   insert into public.support_requests(id,case_id,requested_by,request_body,handoff_status,idempotency_key,
    created_at,sent_at,external_receipt,category,department,priority,submitted_by,submitted_at)
    values((p->'ticket'->>'id')::uuid,v_case,v_owner,'Please review the reported service issue and contact the customer with the next steps.',
     p->'ticket'->>'status','dashboard-v1:ticket:'||v_case,(p->'ticket'->>'at')::timestamptz,
     case when p->'ticket'->>'status'='sent' then (p->'ticket'->>'at')::timestamptz end,
     case when p->'ticket'->>'status'='sent' then 'mock-support:dashboard-v1:'||v_case end,
     p->'ticket'->>'category',app_private.ticket_department(p->'ticket'->>'category'),'normal',v_owner,(p->'ticket'->>'at')::timestamptz);
  end if;
  if (p->>'historical')::boolean and p->'outcome'<>'null'::jsonb then
   insert into public.retention_outcomes(case_id,window_start,window_end,churned,observed_at,source,evidence_ref,is_simulated,recorded_by)
    values(v_case,(p->>'start')::date,(p->>'end')::date-1,(p->>'outcome')::boolean,
     (p->>'end')::timestamp at time zone 'Asia/Ho_Chi_Minh','dashboard-v1:frozen-v5-labels',
     'synthetic_rolling_month_v5:'||(p->>'customer')||':'||(p->>'start'),true,(p->>'supervisor')::uuid);
  end if;
 end loop;
end $seed$;
