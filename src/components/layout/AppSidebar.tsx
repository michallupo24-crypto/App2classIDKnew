import { NavLink, useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Home, BookOpen, Calendar, MessageSquare, BarChart2, Settings,
  Users, ClipboardList, Wand2, GraduationCap, Brain, Star,
  Heart, Shield, User, LogOut, Radio, Clock, FileText,
  Bell, Layers, Target, TreePine, Building, Award
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AvatarPreview from "@/components/avatar/AvatarPreview";

const AppSidebar = () => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  const roles: string[] = (profile as any)?.roles || [];
  const isStudent = roles.includes("student");
  const isTeacher = roles.includes("professional_teacher") || roles.includes("educator");
  const isEducator = roles.includes("educator");
  const isGradeCoord = roles.includes("grade_coordinator");
  const isSubjectCoord = roles.includes("subject_coordinator");
  const isCounselor = roles.includes("counselor");
  const isManagement = roles.includes("management");
  const isAdmin = roles.includes("system_admin");
  const isParent = roles.includes("parent");

  const studentNav = [
    { title: "דף הבית", url: "/dashboard/student-home", icon: Home },
    { title: "המקצועות שלי", url: "/dashboard/subjects", icon: BookOpen },
    { title: "משימות", url: "/dashboard/tasks", icon: ClipboardList },
    { title: "AI Tutor", url: "/dashboard/ai-tutor", icon: Brain },
    { title: "ציונים", url: "/dashboard/grades", icon: Star },
    { title: "נוכחות וחיסורים", url: "/dashboard/attendance", icon: Clock },
    { title: "לוח שנה", url: "/dashboard/schedule", icon: Calendar },
    { title: "צ'אט", url: "/dashboard/chat", icon: MessageSquare },
    { title: "קהילה", url: "/dashboard/community", icon: Users },
  ];

  const teacherNav = [
    { title: "דף הבית", url: "/dashboard/teacher-home", icon: Home },
    { title: "הקראת שמות", url: "/dashboard/roll-call", icon: Users },
    { title: "שיעור חי", url: "/dashboard/live-lesson", icon: Radio },
    { title: "משימות ומטלות", url: "/dashboard/teacher-assignments", icon: ClipboardList },
    { title: "סטודיו משימות", url: "/dashboard/task-studio", icon: Wand2 },
    { title: "ציונים", url: "/dashboard/teacher-grades", icon: BarChart2 },
    { title: "מתכנן מבחנים", url: "/dashboard/exam-planner", icon: Calendar },
    { title: "לוח שנה", url: "/dashboard/schedule", icon: Calendar },
    { title: "צ'אט", url: "/dashboard/chat", icon: MessageSquare },
  ];

  const gradeCoordNav = [
    { title: "דשבורד רכז", url: "/dashboard/grade-coordinator-home", icon: Home },
    { title: "לוח מבחנים", url: "/dashboard/master-scheduler", icon: Calendar },
    { title: "מעקב שכבה", url: "/dashboard/grade-progress", icon: BarChart2 },
    { title: "תגבורים", url: "/dashboard/tutoring", icon: Target },
    { title: "ישיבות צוות", url: "/dashboard/staff-meetings", icon: Users },
    { title: "הודעות שכבה", url: "/dashboard/grade-announcements", icon: Bell },
    { title: "מתכנן מבחנים AI", url: "/dashboard/exam-planner", icon: Brain },
    { title: "צ'אט", url: "/dashboard/chat", icon: MessageSquare },
  ];

  const counselorNav = [
    { title: "מרכז ייעוץ", url: "/dashboard/counselor-home", icon: Heart },
    { title: "לוח שנה", url: "/dashboard/schedule", icon: Calendar },
    { title: "צ'אט", url: "/dashboard/chat", icon: MessageSquare },
  ];

  const parentNav = [
    { title: "הילד שלי", url: "/dashboard/my-child", icon: Home },
    { title: "לוח שנה", url: "/dashboard/schedule", icon: Calendar },
    { title: "צ'אט עם המחנך", url: "/dashboard/chat", icon: MessageSquare },
    { title: "אישורי הורים", url: "/dashboard/event-approvals", icon: FileText },
  ];

  const adminNav = [
    { title: "ניהול מערכת", url: "/dashboard", icon: Home },
    { title: "מבנה ארגוני", url: "/dashboard/system-org-tree", icon: TreePine },
    { title: "אישורים", url: "/dashboard/approvals", icon: Shield },
    { title: "בתי ספר", url: "/dashboard/admin", icon: Building },
    { title: "צ'אט", url: "/dashboard/chat", icon: MessageSquare },
  ];

  const managementNav = [
    { title: "לוח בקרה", url: "/dashboard", icon: Home },
    { title: "מבנה ארגוני", url: "/dashboard/org-tree", icon: TreePine },
    { title: "אישורים", url: "/dashboard/approvals", icon: Shield },
    { title: "לוח מבחנים", url: "/dashboard/master-scheduler", icon: Calendar },
    { title: "צ'אט", url: "/dashboard/chat", icon: MessageSquare },
  ];

  const getNavItems = () => {
    if (isAdmin) return adminNav;
    if (isManagement) return managementNav;
    if (isGradeCoord) return [...gradeCoordNav, ...teacherNav.filter(t => !gradeCoordNav.find(g => g.url === t.url))];
    if (isSubjectCoord || isTeacher) return teacherNav;
    if (isCounselor) return counselorNav;
    if (isParent) return parentNav;
    if (isStudent) return studentNav;
    return [{ title: "דף הבית", url: "/dashboard", icon: Home }];
  };

  const navItems = getNavItems();

  return (
    <Sidebar side="right" className="border-l border-border/50">
      <SidebarContent>
        <SidebarGroup>
          {/* Profile */}
          <div className="p-4 flex items-center gap-3 border-b border-border/50 mb-2">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted border border-primary/20 cursor-pointer" onClick={() => navigate("/dashboard/avatar-edit")}>
              <AvatarPreview userId={profile?.id || ""} size="sm" />
            </div>
            <div className="overflow-hidden">
              <p className="font-heading font-bold text-sm truncate">{profile?.full_name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{roles.join(", ")}</p>
            </div>
          </div>

          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-heading ${isActive ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 p-3 space-y-1">
        <NavLink to="/dashboard/avatar-edit" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-heading">
          <User className="h-3.5 w-3.5" /> עריכת פרופיל
        </NavLink>
        <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors font-heading">
          <LogOut className="h-3.5 w-3.5" /> התנתק
        </button>
      </SidebarFooter>
    </Sidebar>
  );
};

export { AppSidebar };
