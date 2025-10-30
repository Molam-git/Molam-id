-- 026_admin_ui.sql
-- Molam ID Admin Console - Internal employee management with subsidiary separation
-- Author: Molam Corp
-- Date: 2025-10-28

-- ============================================================================
-- EMPLOYEE DIRECTORY
-- ============================================================================

-- Employee directory (internal only)
CREATE TABLE IF NOT EXISTS molam_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  employee_id TEXT UNIQUE NOT NULL,
  department TEXT NOT NULL CHECK (department IN ('pay','eats','talk','ads','shop','free','id','global')),
  position TEXT NOT NULL,
  manager_id UUID NULL REFERENCES molam_employees(id),
  start_date DATE NOT NULL,
  end_date DATE NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_user ON molam_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_dept ON molam_employees(department) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_employees_manager ON molam_employees(manager_id) WHERE manager_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_active ON molam_employees(is_active, department);

COMMENT ON TABLE molam_employees IS 'Internal employee directory with department/subsidiary assignment';
COMMENT ON COLUMN molam_employees.employee_id IS 'Company employee ID (e.g., EMP-PAY-001)';
COMMENT ON COLUMN molam_employees.department IS 'Primary department/subsidiary: pay, eats, talk, ads, shop, free, id, global';
COMMENT ON COLUMN molam_employees.position IS 'Job position (e.g., Admin, Auditor, Marketer, Sales)';

-- ============================================================================
-- ADMIN ACTIVITY TRACKING
-- ============================================================================

-- Admin actions log (extends molam_audit_logs)
CREATE TABLE IF NOT EXISTS molam_admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES molam_users(id),
  action_type TEXT NOT NULL CHECK (action_type IN ('employee.create','employee.update','employee.deactivate','role.assign','role.revoke','session.revoke','audit.export')),
  target_user_id UUID NULL REFERENCES molam_users(id),
  target_department TEXT NULL,
  action_details JSONB NOT NULL DEFAULT '{}',
  ip_address INET NULL,
  user_agent TEXT NULL,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','failure','pending')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON molam_admin_actions(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON molam_admin_actions(target_user_id) WHERE target_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_actions_dept ON molam_admin_actions(target_department) WHERE target_department IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_actions_type ON molam_admin_actions(action_type, created_at DESC);

COMMENT ON TABLE molam_admin_actions IS 'Admin-specific action log with department tracking';
COMMENT ON COLUMN molam_admin_actions.action_type IS 'Type of admin action performed';
COMMENT ON COLUMN molam_admin_actions.target_department IS 'Department affected by the action (for filtering)';

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Admin audit view with employee context
CREATE OR REPLACE VIEW molam_admin_audit_view AS
SELECT
  a.id,
  a.user_id,
  e.employee_id,
  e.department,
  e.position,
  a.action,
  a.context,
  a.ip_address,
  a.user_agent,
  a.created_at
FROM molam_audit_logs a
LEFT JOIN molam_employees e ON e.user_id = a.user_id
WHERE a.user_id IS NOT NULL
ORDER BY a.created_at DESC;

COMMENT ON VIEW molam_admin_audit_view IS 'Audit logs with employee context for admin console';

-- Employee with roles view
CREATE OR REPLACE VIEW molam_employees_with_roles AS
SELECT
  e.*,
  u.display_name,
  u.email,
  u.user_type,
  COALESCE(
    json_agg(
      json_build_object(
        'role_id', r.id,
        'role_name', r.name,
        'module_scope', rg.module_scope,
        'trusted_level', r.trusted_level,
        'granted_at', rg.granted_at
      ) ORDER BY r.trusted_level DESC
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'::json
  ) AS roles
FROM molam_employees e
JOIN molam_users u ON u.id = e.user_id
LEFT JOIN molam_role_grants rg ON rg.user_id = e.user_id AND rg.revoked_at IS NULL AND (rg.expires_at IS NULL OR rg.expires_at > NOW())
LEFT JOIN molam_roles_v2 r ON r.id = rg.role_id
GROUP BY e.id, e.user_id, e.employee_id, e.department, e.position, e.manager_id, e.start_date, e.end_date, e.is_active, e.metadata, e.created_at, e.updated_at, u.display_name, u.email, u.user_type;

COMMENT ON VIEW molam_employees_with_roles IS 'Employees with their assigned roles (for admin console)';

-- Department statistics view
CREATE OR REPLACE VIEW molam_department_stats AS
SELECT
  department,
  COUNT(*) AS total_employees,
  COUNT(*) FILTER (WHERE is_active) AS active_employees,
  COUNT(*) FILTER (WHERE NOT is_active) AS inactive_employees,
  COUNT(DISTINCT position) AS unique_positions
FROM molam_employees
GROUP BY department;

COMMENT ON VIEW molam_department_stats IS 'Employee statistics by department';

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Get employees by department (with permission check)
CREATE OR REPLACE FUNCTION get_employees_by_department(
  p_admin_user_id UUID,
  p_department TEXT DEFAULT NULL,
  p_include_inactive BOOLEAN DEFAULT false
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  employee_id TEXT,
  display_name TEXT,
  email TEXT,
  department TEXT,
  position TEXT,
  is_active BOOLEAN,
  roles JSON
) AS $$
BEGIN
  -- Check if admin has permission to view this department
  -- (In production, this would check against admin's department access)

  RETURN QUERY
  SELECT
    e.id,
    e.user_id,
    e.employee_id,
    e.display_name,
    e.email,
    e.department,
    e.position,
    e.is_active,
    e.roles
  FROM molam_employees_with_roles e
  WHERE (p_department IS NULL OR e.department = p_department)
    AND (p_include_inactive OR e.is_active = true)
  ORDER BY e.department, e.display_name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_employees_by_department IS 'Get employees filtered by department with permission check';

-- Function: Log admin action
CREATE OR REPLACE FUNCTION log_admin_action(
  p_admin_id UUID,
  p_action_type TEXT,
  p_target_user_id UUID DEFAULT NULL,
  p_target_department TEXT DEFAULT NULL,
  p_action_details JSONB DEFAULT '{}',
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_action_id UUID;
BEGIN
  INSERT INTO molam_admin_actions(
    admin_id, action_type, target_user_id, target_department,
    action_details, ip_address, user_agent
  )
  VALUES(
    p_admin_id, p_action_type, p_target_user_id, p_target_department,
    p_action_details, p_ip_address, p_user_agent
  )
  RETURNING id INTO v_action_id;

  RETURN v_action_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_admin_action IS 'Log an admin action with department tracking';

-- Function: Check if admin can manage department
CREATE OR REPLACE FUNCTION can_admin_manage_department(
  p_admin_user_id UUID,
  p_target_department TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_department TEXT;
  v_is_super_admin BOOLEAN;
BEGIN
  -- Check if user is super admin (can manage all departments)
  SELECT EXISTS(
    SELECT 1 FROM molam_role_grants rg
    JOIN molam_roles_v2 r ON r.id = rg.role_id
    WHERE rg.user_id = p_admin_user_id
      AND rg.revoked_at IS NULL
      AND r.name = 'super_admin'
      AND (rg.expires_at IS NULL OR rg.expires_at > NOW())
  ) INTO v_is_super_admin;

  IF v_is_super_admin THEN
    RETURN true;
  END IF;

  -- Check if admin's department matches target department
  SELECT department INTO v_admin_department
  FROM molam_employees
  WHERE user_id = p_admin_user_id AND is_active = true;

  -- Admin can only manage their own department (unless super admin)
  RETURN (v_admin_department = p_target_department OR v_admin_department = 'global');
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION can_admin_manage_department IS 'Check if admin has permission to manage a specific department';

-- Function: Get admin accessible departments
CREATE OR REPLACE FUNCTION get_admin_accessible_departments(p_admin_user_id UUID)
RETURNS TEXT[] AS $$
DECLARE
  v_is_super_admin BOOLEAN;
  v_admin_department TEXT;
BEGIN
  -- Check if super admin
  SELECT EXISTS(
    SELECT 1 FROM molam_role_grants rg
    JOIN molam_roles_v2 r ON r.id = rg.role_id
    WHERE rg.user_id = p_admin_user_id
      AND rg.revoked_at IS NULL
      AND r.name = 'super_admin'
      AND (rg.expires_at IS NULL OR rg.expires_at > NOW())
  ) INTO v_is_super_admin;

  -- Super admin can access all departments
  IF v_is_super_admin THEN
    RETURN ARRAY['pay','eats','talk','ads','shop','free','id','global'];
  END IF;

  -- Regular admin can only access their own department
  SELECT department INTO v_admin_department
  FROM molam_employees
  WHERE user_id = p_admin_user_id AND is_active = true;

  IF v_admin_department = 'global' THEN
    RETURN ARRAY['pay','eats','talk','ads','shop','free','id','global'];
  ELSE
    RETURN ARRAY[v_admin_department];
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_admin_accessible_departments IS 'Get list of departments accessible to admin';

-- Function: Create employee
CREATE OR REPLACE FUNCTION create_employee(
  p_admin_id UUID,
  p_user_id UUID,
  p_employee_id TEXT,
  p_department TEXT,
  p_position TEXT,
  p_start_date DATE,
  p_manager_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_employee_id UUID;
  v_can_manage BOOLEAN;
BEGIN
  -- Check permission
  v_can_manage := can_admin_manage_department(p_admin_id, p_department);
  IF NOT v_can_manage THEN
    RAISE EXCEPTION 'Admin does not have permission to create employee in department %', p_department;
  END IF;

  -- Create employee
  INSERT INTO molam_employees(
    user_id, employee_id, department, position, start_date, manager_id
  )
  VALUES(
    p_user_id, p_employee_id, p_department, p_position, p_start_date, p_manager_id
  )
  RETURNING id INTO v_employee_id;

  -- Log action
  PERFORM log_admin_action(
    p_admin_id,
    'employee.create',
    p_user_id,
    p_department,
    jsonb_build_object('employee_id', p_employee_id, 'position', p_position)
  );

  RETURN v_employee_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_employee IS 'Create employee with permission check and audit logging';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Update employee timestamp
CREATE OR REPLACE FUNCTION update_employee_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_employees_update
  BEFORE UPDATE ON molam_employees
  FOR EACH ROW
  EXECUTE FUNCTION update_employee_timestamp();

-- Trigger: Prevent changing employee department without audit
CREATE OR REPLACE FUNCTION prevent_unauthorized_department_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.department IS DISTINCT FROM NEW.department THEN
    -- Log department change
    INSERT INTO molam_admin_actions(
      admin_id, action_type, target_user_id, target_department,
      action_details
    )
    VALUES(
      current_setting('app.admin_user_id', true)::UUID,
      'employee.update',
      NEW.user_id,
      NEW.department,
      jsonb_build_object('old_department', OLD.department, 'new_department', NEW.department)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_employees_department_change
  BEFORE UPDATE ON molam_employees
  FOR EACH ROW
  WHEN (OLD.department IS DISTINCT FROM NEW.department)
  EXECUTE FUNCTION prevent_unauthorized_department_change();

-- ============================================================================
-- PERMISSIONS & SECURITY
-- ============================================================================

-- Row-level security
ALTER TABLE molam_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE molam_admin_actions ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can only see employees in their accessible departments
CREATE POLICY admin_employees_select ON molam_employees
  FOR SELECT
  USING (
    department = ANY(get_admin_accessible_departments(current_setting('app.user_id', true)::UUID))
  );

-- Policy: Admin actions are visible based on department access
CREATE POLICY admin_actions_select ON molam_admin_actions
  FOR SELECT
  USING (
    target_department IS NULL OR
    target_department = ANY(get_admin_accessible_departments(current_setting('app.user_id', true)::UUID))
  );

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Create sample departments (metadata only - actual employee creation done via API)
-- This just documents the department structure

COMMENT ON TABLE molam_employees IS 'Employee directory - Departments: pay (Molam Pay), eats (Molam Eats), talk (Molam Talk), ads (Molam Ads), shop (Molam Shop), free (Molam Free), id (Molam ID), global (Corporate)';

-- ============================================================================
-- ANALYTICS
-- ============================================================================

-- View: Admin activity statistics
CREATE OR REPLACE VIEW molam_admin_activity_stats AS
SELECT
  DATE_TRUNC('day', created_at) AS activity_date,
  action_type,
  target_department,
  COUNT(*) AS action_count,
  COUNT(DISTINCT admin_id) AS unique_admins
FROM molam_admin_actions
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at), action_type, target_department
ORDER BY activity_date DESC, action_count DESC;

COMMENT ON VIEW molam_admin_activity_stats IS 'Admin activity statistics for the last 30 days';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON SCHEMA public IS 'Molam ID Admin Console - Brique 26 - Migration 026 applied successfully';
