-- 02_kyc_functions.sql

CREATE OR REPLACE FUNCTION set_kyc_status(req_id UUID, new_status TEXT, reason TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE molam_kyc_requests SET status=new_status, reason=reason, updated_at=now() WHERE id=req_id;
  INSERT INTO molam_kyc_audit (kyc_request_id, actor_id, action, details)
  VALUES (req_id, NULL, 'status_change', to_jsonb(json_build_object('new_status', new_status, 'reason', reason, 'ts', now())));
END;
$$;

CREATE OR REPLACE FUNCTION get_user_kyc_level(user_uuid UUID)
RETURNS TEXT LANGUAGE sql AS $$
  SELECT requested_level FROM molam_kyc_requests WHERE user_id=user_uuid AND status='verified' ORDER BY created_at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_kyc_limits(kyc_level TEXT)
RETURNS TABLE(daily_limit NUMERIC, per_tx_limit NUMERIC) LANGUAGE sql AS $$
  SELECT daily_limit, per_tx_limit FROM molam_limits WHERE kyc_level = $1;
$$;
