"""Shared feature names, calendar boundaries and table helpers for synthetic data."""
from datetime import date, datetime, time, timedelta, timezone
import pandas as pd

VN = timezone(timedelta(hours=7))

GROUPS = {
    'Connection Quality': ['disconnect_count_30d', 'outage_minutes_30d', 'evening_speed_ratio_30d', 'service_issue_days_30d'],
    'Usage & Engagement': ['usage_gb_7d', 'usage_gb_30d', 'usage_change_pct_30d', 'inactive_days_14d'],
    'Billing & Payment': ['monthly_fee_vnd', 'fee_change_pct_30d', 'overdue_days', 'overdue_amount_vnd'],
    'Renewal & Promotions': ['billing_mode', 'prepaid_days_remaining', 'promo_days_remaining'],
    'Support Experience': ['support_contacts_30d', 'unresolved_tickets_30d', 'repeat_contacts_30d', 'avg_resolution_hours_90d'],
    'Customer Relationship & Plan': ['tenure_months', 'plan_speed_mbps', 'plan_change_requests_30d'],
}

FEATURES = [f for group in GROUPS.values() for f in group]

def next_month(d):
    return date(d.year + (d.month == 12), d.month % 12 + 1, 1)

def utc_at(d, hour=0):
    return datetime.combine(d, time(hour), VN).astimezone(timezone.utc).isoformat()

def frame(rows, columns):
    return pd.DataFrame(rows, columns=columns)
