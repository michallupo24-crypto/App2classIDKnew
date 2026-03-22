import { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Brain, Send, Loader2, BookOpen, Target, Sparkles,
  FileText, Upload, MessageSquare, Clock, ChevronDown
} from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SUBJECTS } from "@/lib/constants";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const AITutorPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"chat" | "exam-prep" | "summarize" | "practice">("chat");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [uploadedContent, setUploadedContent] = useState("");
  const [examDate, setExamDate] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (customMessage?: string) => {
    const msg = customMessage || input;
    if (!msg.trim() || loading) return;
    setInput("");

    const newMessages = [...messages, { role: "user" as const, content: msg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const systemPrompt = mode === "exam-prep"
        ? `אתה מורה מקצועי ל${selectedSubject}. עזור לתלמיד להתכונן למבחן ב-${examDate ? new Date(examDate).toLocaleDateString("he-IL") : "תאריך קרוב"}. חלק את החומר לימים, תן טיפים ושאלות תרגול.`
        : mode === "summarize"
        ? `אתה מסכם שיעורים מקצועי. סכם בנקודות מפתח ברורות בעברית. השתמש בכותרות, נקודות ודוגמאות.`
        : mode === "practice"
        ? `אתה מורה שבוחן תלמידים. צור שאלות תרגול מותאמות לרמה ב${selectedSubject}. לאחר כל תשובה תן פידבק מפורט.`
        : `אתה AI Tutor חינוכי ידידותי. עזור לתלמיד להבין חומר, ענה על שאלות ותן הסברים בעברית ברורה.`;

      const { data, error } = await supabase.functions.invoke("ai-tutor", {
        body: {
          message: msg,
          systemPrompt,
          history: newMessages.slice(-6),
          subject: selectedSubject,
          uploadedContent,
        },
      });

      if (error) throw error;
      const response = data?.response || data?.content?.[0]?.text || "לא הצלחתי לענות, נסה שוב.";
      setMessages([...newMessages, { role: "assistant", content: response }]);
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    toast({ title: "קורא את הקובץ..." });
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedContent(ev.target?.result as string);
      toast({ title: "קובץ נטען! עכשיו שאל שאלות על התוכן ✅" });
    };
    reader.readAsText(file);
  };

  const quickActions = [
    { label: "סכם את השיעור", msg: `סכם את החומר הבא בנקודות מפתח:\n${uploadedContent || "תן לי מבוא לנושא " + (selectedSubject || "כללי")}` },
    { label: "5 שאלות תרגול", msg: `צור לי 5 שאלות תרגול ב${selectedSubject || "החומר"} עם תשובות` },
    { label: "הכן אותי למבחן", msg: `אני צריך להתכונן למבחן ב${selectedSubject || "המקצוע"}. בנה לי תוכנית לימוד ל-3 ימים` },
    { label: "הסבר בשפה פשוטה", msg: `הסבר לי את הנושא ${selectedSubject || "הנלמד"} בשפה פשוטה ועם דוגמאות מהחיים` },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 h-full flex flex-col" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-heading font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-accent" /> AI Tutor
        </h1>
        <div className="flex gap-2">
          {(["chat", "exam-prep", "summarize", "practice"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-2.5 py-1 rounded-lg text-xs font-heading transition-all ${mode === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              {m === "chat" ? "שיחה" : m === "exam-prep" ? "מבחן" : m === "summarize" ? "סיכום" : "תרגול"}
            </button>
          ))}
        </div>
      </div>

      {/* Settings row */}
      <div className="flex gap-2">
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="מקצוע" /></SelectTrigger>
          <SelectContent>
            {SUBJECTS.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {mode === "exam-prep" && (
          <Input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} className="h-8 text-xs w-36" dir="ltr" />
        )}
        <input type="file" ref={fileRef} accept=".txt,.pdf,.doc,.docx" className="hidden" onChange={handleFileUpload} />
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => fileRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> העלה חומר
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-64 max-h-96 p-1">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Brain className="h-12 w-12 text-accent/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">שלום! אני ה-AI Tutor שלך. שאל אותי כל שאלה 🎓</p>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {quickActions.map((a, i) => (
                <button key={i} onClick={() => sendMessage(a.msg)}
                  className="px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-heading hover:bg-accent/20 transition-all">
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
              {m.role === "assistant" ? (
                <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl p-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              <span className="text-xs text-muted-foreground">חושב...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="שאל שאלה, בקש הסבר, תרגיל..."
          className="h-10 text-sm"
        />
        <Button onClick={() => sendMessage()} disabled={loading || !input.trim()} className="h-10 px-4">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </motion.div>
  );
};

export default AITutorPage;
