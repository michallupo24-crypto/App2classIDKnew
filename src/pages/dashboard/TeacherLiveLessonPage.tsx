import { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Play, Square, MessageSquare, BarChart2, Zap, Users,
  Brain, AlertCircle, CheckCircle2, Send, Eye, EyeOff,
  Radio, Cloud, Timer, TrendingDown
} from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SUBJECTS, GRADES } from "@/lib/constants";
import { format } from "date-fns";
import { he } from "date-fns/locale";

const TeacherLiveLessonPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [lessonTopic, setLessonTopic] = useState("");
  const [questions, setQuestions] = useState<any[]>([]);
  const [focusData, setFocusData] = useState<any[]>([]);
  const [avgFocus, setAvgFocus] = useState(75);
  const [activeTab, setActiveTab] = useState<"questions" | "pulse" | "poll" | "wordcloud">("questions");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", "", "", ""]);
  const [activePoll, setActivePoll] = useState<any>(null);
  const [pollResults, setPollResults] = useState<Record<string, number>>({});
  const [wordCloudWords, setWordCloudWords] = useState<Record<string, number>>({});
  const [wordInput, setWordInput] = useState("");
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    loadClasses();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    if (session) {
      // Poll for new questions and focus data every 3s
      intervalRef.current = setInterval(() => {
        loadQuestions(session.id);
        loadFocusData(session.id);
      }, 3000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [session]);

  const loadClasses = async () => {
    const { data } = await supabase.from("teacher_classes")
      .select("class_id, classes(id, grade, class_number)")
      .eq("user_id", profile.id);
    setClasses(data?.map((d: any) => d.classes) || []);
  };

  const loadQuestions = async (sessionId: string) => {
    const { data } = await supabase.from("live_questions")
      .select("*").eq("session_id", sessionId)
      .order("created_at", { ascending: false });
    setQuestions(data || []);
  };

  const loadFocusData = async (sessionId: string) => {
    const { data } = await supabase.from("focus_reports")
      .select("focus_level, student_id").eq("session_id", sessionId);
    setFocusData(data || []);
    if (data?.length) {
      const avg = Math.round(data.reduce((s: number, d: any) => s + d.focus_level, 0) / data.length);
      setAvgFocus(avg);
    }
  };

  const startLesson = async () => {
    if (!selectedClass || !selectedSubject) {
      toast({ title: "בחר כיתה ומקצוע", variant: "destructive" }); return;
    }
    const { data, error } = await supabase.from("live_sessions").insert({
      teacher_id: profile.id,
      class_id: selectedClass,
      subject: selectedSubject,
      lesson_topic: lessonTopic,
      session_date: new Date().toISOString(),
      is_active: true,
    }).select().single();
    if (error) { toast({ title: "שגיאה", description: error.message, variant: "destructive" }); return; }
    setSession(data);
    toast({ title: "השיעור התחיל! 🎯 התלמידים יכולים להצטרף" });
  };

  const endLesson = async () => {
    if (!session) return;
    await supabase.from("live_sessions").update({ is_active: false }).eq("id", session.id);
    setSession(null);
    setQuestions([]);
    setFocusData([]);
    toast({ title: "השיעור הסתיים" });
  };

  const answerQuestion = async (qId: string) => {
    await supabase.from("live_questions").update({ is_answered: true }).eq("id", qId);
    loadQuestions(session.id);
  };

  const sendPoll = async () => {
    if (!pollQuestion || !session) return;
    const opts = pollOptions.filter(o => o.trim());
    const { data } = await supabase.from("live_polls").insert({
      session_id: session.id,
      question: pollQuestion,
      options: opts,
      is_active: true,
    }).select().single();
    setActivePoll(data);
    setPollQuestion(""); setPollOptions(["", "", "", ""]);
    toast({ title: "סקר נשלח לתלמידים! 📊" });
  };

  const getFocusColor = (level: number) => {
    if (level >= 70) return "text-success";
    if (level >= 40) return "text-warning";
    return "text-destructive";
  };

  const getFocusLabel = (level: number) => {
    if (level >= 80) return "מרוכז מאוד 🎯";
    if (level >= 60) return "בעניין 👍";
    if (level >= 40) return "חלקית 😐";
    return "אבוד 😕";
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Radio className="h-7 w-7 text-destructive" /> שיעור חי
          {session && <Badge className="bg-destructive text-white animate-pulse">● שידור חי</Badge>}
        </h1>
      </div>

      {!session ? (
        <Card>
          <CardHeader><CardTitle className="text-lg font-heading">התחל שיעור חדש</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-heading">כיתה</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="בחר כיתה" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c: any) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">{c.grade}׳{c.class_number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-heading">מקצוע</Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="בחר מקצוע" /></SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-heading">נושא השיעור</Label>
              <Input value={lessonTopic} onChange={e => setLessonTopic(e.target.value)} placeholder="למשל: משוואות ריבועיות" className="h-9 text-xs" />
            </div>
            <Button className="w-full gap-2 font-heading" onClick={startLesson}>
              <Play className="h-4 w-4" /> התחל שיעור
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Session info + end button */}
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-heading font-bold">{selectedSubject} — {lessonTopic}</p>
                <p className="text-xs text-muted-foreground">{focusData.length} תלמידים מחוברים</p>
              </div>
              <Button variant="destructive" size="sm" className="gap-1 font-heading" onClick={endLesson}>
                <Square className="h-4 w-4" /> סיים שיעור
              </Button>
            </CardContent>
          </Card>

          {/* Focus meter */}
          <Card className={avgFocus < 50 ? "border-destructive/30" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-heading font-bold text-sm flex items-center gap-2">
                  <Brain className="h-4 w-4 text-accent" /> דופק כיתתי
                </h3>
                <span className={`text-lg font-bold font-heading ${getFocusColor(avgFocus)}`}>
                  {avgFocus}% — {getFocusLabel(avgFocus)}
                </span>
              </div>
              <Progress value={avgFocus} className="h-4" />
              {avgFocus < 50 && (
                <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                  <TrendingDown className="h-3.5 w-3.5" /> הכיתה לא מרוכזת — שקול הפסקה קצרה
                </p>
              )}
            </CardContent>
          </Card>

          {/* Tabs */}
          <div className="flex gap-2 border-b">
            {[
              { id: "questions", label: "שאלות", icon: MessageSquare, count: questions.filter(q => !q.is_answered).length },
              { id: "pulse", label: "דופק", icon: Brain },
              { id: "poll", label: "סקר", icon: BarChart2 },
              { id: "wordcloud", label: "ענן מילים", icon: Cloud },
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-heading border-b-2 transition-colors ${activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {t.count ? <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{t.count}</Badge> : null}
              </button>
            ))}
          </div>

          {/* Questions tab */}
          {activeTab === "questions" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{questions.filter(q => !q.is_answered).length} שאלות ממתינות</p>
              {questions.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">אין שאלות עדיין</CardContent></Card>
              ) : (
                questions.map(q => (
                  <Card key={q.id} className={q.is_answered ? "opacity-50" : ""}>
                    <CardContent className="p-4 flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-body">{q.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px]">👍 {q.upvotes}</Badge>
                          {q.is_anonymous && <Badge variant="secondary" className="text-[10px]">אנונימי</Badge>}
                        </div>
                      </div>
                      {!q.is_answered ? (
                        <Button size="sm" variant="outline" className="text-xs font-heading shrink-0" onClick={() => answerQuestion(q.id)}>
                          <CheckCircle2 className="h-3.5 w-3.5 ml-1" /> ניתנה תשובה
                        </Button>
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Focus breakdown */}
          {activeTab === "pulse" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "מרוכזים", count: focusData.filter(d => d.focus_level >= 70).length, color: "text-success", bg: "bg-success/10" },
                  { label: "בעניין", count: focusData.filter(d => d.focus_level >= 40 && d.focus_level < 70).length, color: "text-warning", bg: "bg-warning/10" },
                  { label: "אבודים", count: focusData.filter(d => d.focus_level < 40).length, color: "text-destructive", bg: "bg-destructive/10" },
                ].map((s, i) => (
                  <Card key={i} className={s.bg}>
                    <CardContent className="p-3 text-center">
                      <p className={`text-2xl font-bold font-heading ${s.color}`}>{s.count}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Poll */}
          {activeTab === "poll" && (
            <div className="space-y-4">
              {!activePoll ? (
                <Card>
                  <CardContent className="p-5 space-y-3">
                    <Label className="text-xs font-heading">שאלת הסקר</Label>
                    <Input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="מה הסיבה לתנועת כדור הארץ?" className="text-sm" />
                    <Label className="text-xs font-heading">אפשרויות (עד 4)</Label>
                    {pollOptions.map((opt, i) => (
                      <Input key={i} value={opt} onChange={e => { const u = [...pollOptions]; u[i] = e.target.value; setPollOptions(u); }}
                        placeholder={`אפשרות ${i + 1}`} className="text-xs h-8" />
                    ))}
                    <Button className="w-full gap-2 font-heading" onClick={sendPoll} disabled={!pollQuestion}>
                      <Send className="h-4 w-4" /> שלח סקר לכיתה
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-5 space-y-3">
                    <p className="font-heading font-bold">{activePoll.question}</p>
                    {(activePoll.options || []).map((opt: string, i: number) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{opt}</span>
                          <span>{pollResults[opt] || 0} תגובות</span>
                        </div>
                        <Progress value={((pollResults[opt] || 0) / Math.max(focusData.length, 1)) * 100} className="h-3" />
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setActivePoll(null)}>סקר חדש</Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Word cloud */}
          {activeTab === "wordcloud" && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-5 space-y-3">
                  <p className="text-xs font-heading font-bold">ביקש תלמידים לכתוב מילה אחת</p>
                  <div className="flex flex-wrap gap-2 min-h-24 p-3 rounded-lg bg-muted/30 border">
                    {Object.entries(wordCloudWords).map(([word, count]) => (
                      <span key={word} className="font-heading font-bold text-primary" style={{ fontSize: `${Math.min(8 + count * 4, 28)}px` }}>
                        {word}
                      </span>
                    ))}
                    {Object.keys(wordCloudWords).length === 0 && (
                      <p className="text-xs text-muted-foreground m-auto">ממתין למילים מהתלמידים...</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default TeacherLiveLessonPage;
