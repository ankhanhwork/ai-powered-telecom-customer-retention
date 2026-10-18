create or replace function public.retention_worker_context(p_job_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_job public.automation_jobs; v_case public.retention_cases; v_context jsonb;
begin
  perform app_private.require_worker();
  select * into v_job from public.automation_jobs where id=p_job_id and status='queued';
  if not found then raise exception 'Job is not pending'; end if;
  select * into v_case from public.retention_cases where id=v_job.case_id;
  select context into v_context from public.prediction_contexts where prediction_id=v_case.prediction_id order by created_at desc limit 1;
  -- Deliberately omit feature vectors, score, raw SHAP, labels and generator audit.
  -- Customer text is untrusted content, never an instruction to override policy.
  return jsonb_build_object('snapshot_date',(select snapshot_date from public.churn_predictions where id=v_case.prediction_id),'target_period_start',v_case.target_period_start,'requested_at',v_job.created_at,'current_time',now(),'rewrite_instructions',v_job.rewrite_instructions,'rewrite_source_text',v_job.rewrite_source_text,'case_id',v_case.id,'requested_output',case when split_part(v_job.request_key,':',1)='manual' then split_part(v_job.request_key,':',2) else 'care_pack' end,'language','English','requires_staff_review',true,
    'customer',(select jsonb_build_object('display_name',display_name,'plan_name',plan_name,
      'monthly_fee',monthly_fee,'currency',currency,'billing_mode',billing_mode,'tenure_months',tenure_months)
      from public.customers where id=v_case.customer_id),
    'driver_groups',coalesce((select jsonb_agg(jsonb_build_object('rank',d->'rank','group_name',d->'group_name',
      'evidence_status',d->'evidence_status','supports_customer_situation_claim',d->'supports_customer_situation_claim',
      'suggested_action',d->'suggested_action','facts',coalesce((select jsonb_agg(jsonb_build_object('label',f->'label',
        'value',f->'value','unit',f->'unit','missing',f->'missing','observation',f->'observation'))
        from jsonb_array_elements(d->'facts') f),'[]'))) from jsonb_array_elements(v_context->'drivers') d),'[]'),
    'eligible_offers',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'title',o.title,'description',o.description,
      'requires_supervisor',o.requires_supervisor)) from public.offers o join public.customer_offer_eligibility e on e.offer_id=o.id
      where e.customer_id=v_case.customer_id and e.eligible and e.valid_until>now()
        and o.active and o.valid_from<=now() and o.valid_until>now()),'[]'),
    'conversation',coalesce((select jsonb_agg(jsonb_build_object('direction',m.direction,'body',r.body,'created_at',m.created_at)
      order by m.created_at,m.id) from public.messages m join public.message_revisions r on r.message_id=m.id
        and r.revision=case when m.direction='outbound' then m.sent_revision else m.current_revision end
      where m.case_id=v_case.id and m.visibility='external' and
        (m.direction='inbound' or (m.direction='outbound' and m.delivery_status='sent'))),'[]'));
end $$;
notify pgrst,'reload schema';
