import { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  BarChart3, Users, TrendingUp, TrendingDown, AlertTriangle, Award,
  Loader2, FileText, Save, CheckCircle2,
} from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface ClassOption {
  id: string;
  grade: string;
  number: number;
}

interface AssignmentOption {
  id: string;
  title: string;
  subject: string;
  type: string;
  maxGrade: number;
  weight: number;
}

interface StudentGrade {
  submissionId: string | null;
  studentId: string;
  studentName: string;
  grade: number | null;
  status: string;
  feedback: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  homework: "שיעורי בית",
  exam: "מבחן",
  quiz: "בוחן",
  project: "פרויקט",
  exercise: "תרגיל",
};

const PERCENTILE_BINS = [
  { label: "0-54", min: 0, max: 54, color: "hsl(var(--destructive))" },
  { label: "55-69", min: 55, max: 69, color: "hsl(var(--warning))" },
  { label: "70-84", min: 70, max: 84, color: "hsl(var(--primary))" },
  { label: "85-100", min: 85, max: 100, color: "hsl(var(--success))" },
];

const TeacherGradesPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState("");
  const [studentGrades, setStudentGrades] = useState<StudentGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradeEdits, setGradeEdits] = useState<Record<string, { grade: string; feedback: string }>>({});
  const [saving, setSaving] = useState(false);
  const [showGrading, setShowGrading] = useState(false);

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
  const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  // Load classes
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("teacher_classes")
        .select("class_id, classes(id, grade, class_number)")
        .eq("user_id", profile.id);
      if (data) {
        const cls = data.map((d: any) => ({
          id: d.classes.id,
          grade: d.classes.grade,
          number: d.classes.class_number,
        }));
        setClasses(cls);
        if (cls.length > 0) setSelectedClass(cls[0].id);
      }
      setLoading(false);
    };
    load();
  }, [profile.id]);

  // Load assignments for selected class
  useEffect(() => {
    if (!selectedClass) return;
    const load = async () => {
      const { data } = await supabase
        .from("assignments")
        .select("id, title, subject, type, max_grade, weight_percent")
        .eq("teacher_id", profile.id)
        .eq("class_id", selectedClass)
        .order("created_at", { ascending: false });
      if (data) {
        setAssignments(
          data.map((a: any) => ({
            id: a.id,
            title: a.title,
            subject: a.subject,
            type: a.type,
            maxGrade: a.max_grade || 100,
            weight: a.weight_percent || 0,
          }))
        );
        if (data.length > 0) setSelectedAssignment(data[0].id);
        else setSelectedAssignment("");
      }
    };
    load();
  }, [selectedClass, profile.id]);

  // Load student grades for selected assignment
  useEffect(() => {
    if (!selectedAssignment || !selectedClass) return;
    const load = async () => {
      setLoading(true);
      // Get all students in this class
      const { data: students } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("class_id", selectedClass)
        .order("full_name");

      // Get submissions for this assignment
      const { data: submissions } = await supabase
        .from("submissions")
        .select("id, student_id, grade, status, feedback")
        .eq("assignment_id", selectedAssignment);

      const subMap = new Map((submissions || []).map((s: any) => [s.student_id, s]));

      setStudentGrades(
        (students || []).map((st: any) => {
          const sub = subMap.get(st.id);
          return {
            submissionId: sub?.id || null,
            studentId: st.id,
            studentName: st.full_name,
            grade: sub?.grade ?? null,
            status: sub?.status || "draft",
            feedback: sub?.feedback || null,
          };
        })
      );
      setGradeEdits({});
      setLoading(false);
    };
    load();
  }, [selectedAssignment, selectedClass]);

  // Stats
  const stats = useMemo(() => {
    const graded = studentGrades.filter((s) => s.grade !== null);
    if (graded.length === 0) return null;
    const assignment = assignments.find((a) => a.id === selectedAssignment);
    const maxG = assignment?.maxGrade || 100;
    const normalizedGrades = graded.map((s) => ((s.grade! / maxG) * 100));
    const sorted = [...normalizedGrades].sort((a, b) => a - b);
    const avg = Math.round(sorted.reduce((s, g) => s + g, 0) / sorted.length);
    const median = Math.round(sorted[Math.floor(sorted.length / 2)]);
    const stdDev = Math.round(
      Math.sqrt(sorted.reduce((s, g) => s + (g - avg) ** 2, 0) / sorted.length)
    );
    const weak = graded.filter((s) => (s.grade! / maxG) * 100 < 60).length;
    const strong = graded.filter((s) => (s.grade! / maxG) * 100 >= 90).length;

    const distribution = PERCENTILE_BINS.map((bin) => ({
      ...bin,
      count: normalizedGrades.filter((g) => g >= bin.min && g <= bin.max).length,
    }));

    return { avg, median, stdDev, weak, strong, total: studentGrades.length, graded: graded.length, distribution };
  }, [studentGrades, selectedAssignment, assignments]);

  const handleGradeChange = (studentId: string, field: "grade" | "feedback", value: string) => {
    setGradeEdits((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value, grade: prev[studentId]?.grade || "", feedback: prev[studentId]?.feedback || "" },
    }));
  };

  const saveGrades = async () => {
    setSaving(true);
    const assignment = assignments.find((a) => a.id === selectedAssignment);
    try {
      for (const [studentId, edit] of Object.entries(gradeEdits)) {
        const gradeNum = parseInt(edit.grade);
        if (isNaN(gradeNum)) continue;

        const existing = studentGrades.find((s) => s.studentId === studentId);
        if (existing?.submissionId) {
          // Update existing submission
          await supabase.from("submissions").update({
            grade: gradeNum,
            feedback: edit.feedback || null,
            status: "graded" as any,
            graded_by: profile.id,
            graded_at: new Date().toISOString(),
          }).eq("id", existing.submissionId);
        } else {
          // Create new submission with grade
          await supabase.from("submissions").insert({
            assignment_id: selectedAssignment,
            student_id: studentId,
            grade: gradeNum,
            feedback: edit.feedback || null,
            status: "graded" as any,
            graded_by: profile.id,
            graded_at: new Date().toISOString(),
            submitted_at: new Date().toISOString(),
          });
        }
      }
      toast({ title: "הציונים נשמרו בהצלחה! ✅" });
      // Reload
      setSelectedAssignment((prev) => {
        setTimeout(() => setSelectedAssignment(prev), 100);
        return "";
      });
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const gradeColor = (g: number) => {
    if (g >= 90) return "text-success";
    if (g >= 75) return "text-primary";
    if (g >= 60) return "text-warning";
    return "text-destructive";
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-primary" />
          ציונים וסטטיסטיקות
        </h1>
        <p className="text-sm text-muted-foreground font-body mt-1">הזנת ציונים, ניתוח התפלגות וזיהוי תלמידים</p>
      </motion.div>

      {/* Selectors */}
      <motion.div variants={item} className="flex flex-wrap gap-3">
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="בחר כיתה" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.grade}'{c.number}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="בחר משימה" />
          </SelectTrigger>
          <SelectContent>
            {assignments.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {TYPE_LABELS[a.type] || a.type} — {a.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          className="gap-2 font-heading"
          onClick={() => setShowGrading(true)}
          disabled={!selectedAssignment}
        >
          <FileText className="h-4 w-4" />
          הזן ציונים
        </Button>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !selectedAssignment ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-body">בחר כיתה ומשימה כדי לצפות בציונים</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats cards */}
          {stats && (
            <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card>
                <CardContent className="py-3 text-center">
                  <p className={`text-2xl font-heading font-bold ${gradeColor(stats.avg)}`}>{stats.avg}</p>
                  <p className="text-[10px] text-muted-foreground">ממוצע</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3 text-center">
                  <p className="text-2xl font-heading font-bold text-primary">{stats.median}</p>
                  <p className="text-[10px] text-muted-foreground">חציון</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3 text-center">
                  <p className="text-2xl font-heading font-bold">{stats.stdDev}</p>
                  <p className="text-[10px] text-muted-foreground">סט״ת</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3 text-center">
                  <p className="text-2xl font-heading font-bold text-destructive">{stats.weak}</p>
                  <p className="text-[10px] text-muted-foreground">נכשלים (&lt;60)</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3 text-center">
                  <p className="text-2xl font-heading font-bold text-success">{stats.strong}</p>
                  <p className="text-[10px] text-muted-foreground">מצטיינים (&gt;90)</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Distribution chart */}
          {stats && stats.graded > 0 && (
            <motion.div variants={item}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-heading flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    התפלגות ציונים
                    <Badge variant="outline" className="text-[10px]">{stats.graded}/{stats.total} נבדקו</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.distribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          formatter={(value: any) => [`${value} תלמידים`, "כמות"]}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {stats.distribution.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Student list */}
          <motion.div variants={item}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  ציוני תלמידים
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {studentGrades.map((sg) => {
                  const assignment = assignments.find((a) => a.id === selectedAssignment);
                  const maxG = assignment?.maxGrade || 100;
                  const normalized = sg.grade !== null ? Math.round((sg.grade / maxG) * 100) : null;

                  return (
                    <div
                      key={sg.studentId}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-heading text-sm truncate">{sg.studentName}</span>
                        {sg.feedback && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-32">💬 {sg.feedback}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {sg.grade !== null ? (
                          <>
                            <span className={`font-heading font-bold text-lg ${gradeColor(normalized!)}`}>
                              {sg.grade}
                            </span>
                            {maxG !== 100 && (
                              <span className="text-xs text-muted-foreground">/{maxG}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">טרם הוזן</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>

          {/* Grading dialog */}
          <Dialog open={showGrading} onOpenChange={setShowGrading}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-heading">הזנת ציונים</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                {studentGrades.map((sg) => {
                  const edit = gradeEdits[sg.studentId];
                  const currentGrade = edit?.grade ?? (sg.grade?.toString() || "");
                  const currentFeedback = edit?.feedback ?? (sg.feedback || "");

                  return (
                    <div key={sg.studentId} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                      <span className="font-heading text-sm flex-1 min-w-0 truncate">{sg.studentName}</span>
                      <Input
                        type="number"
                        placeholder="ציון"
                        className="w-20 text-center"
                        dir="ltr"
                        value={currentGrade}
                        onChange={(e) => handleGradeChange(sg.studentId, "grade", e.target.value)}
                      />
                      <Input
                        placeholder="משוב..."
                        className="w-32 text-xs"
                        value={currentFeedback}
                        onChange={(e) => handleGradeChange(sg.studentId, "feedback", e.target.value)}
                      />
                    </div>
                  );
                })}
                <Button
                  className="w-full gap-2 font-heading"
                  onClick={saveGrades}
                  disabled={saving || Object.keys(gradeEdits).length === 0}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "שומר..." : "שמור ציונים"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </motion.div>
  );
};

export default TeacherGradesPage;
