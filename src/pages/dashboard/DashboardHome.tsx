import { useOutletContext, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import type { UserProfile } from "@/hooks/useAuth";

const DashboardHome = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const navigate = useNavigate();
  const roles: string[] = (profile as any)?.roles || [];

  useEffect(() => {
    // Auto-route based on primary role
    if (roles.includes("system_admin")) {
      navigate("/dashboard/system-org-tree", { replace: true });
    } else if (roles.includes("management")) {
      navigate("/dashboard/org-tree", { replace: true });
    } else if (roles.includes("grade_coordinator")) {
      navigate("/dashboard/grade-coordinator-home", { replace: true });
    } else if (roles.includes("subject_coordinator") || roles.includes("professional_teacher") || roles.includes("educator")) {
      navigate("/dashboard/teacher-home", { replace: true });
    } else if (roles.includes("counselor")) {
      navigate("/dashboard/counselor-home", { replace: true });
    } else if (roles.includes("parent")) {
      navigate("/dashboard/my-child", { replace: true });
    } else if (roles.includes("student")) {
      navigate("/dashboard/student-home", { replace: true });
    }
  }, [roles]);

  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

export default DashboardHome;
