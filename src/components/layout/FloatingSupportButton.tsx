import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, HelpCircle, Bug, BookOpen, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

const FloatingSupportButton = () => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "ai" | "bug">("menu");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [bugDesc, setBugDesc] = useState("");

  const askAI = async () => {
    if (!question) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("ai-tutor", {
        body: {
          message: question,
          systemPrompt: "אתה עוזר תמיכה של App2Class. ענה בעברית על שאלות על השימוש במערכת. היה קצר וברור.",
        },
      });
      setAnswer(data?.response || "לא הצלחתי לענות, נסה שוב.");
    } catch {
      setAnswer("שגיאה בחיבור. נסה שוב.");
    } finally {
      setLoading(false);
    }
  };

  const reportBug = async () => {
    if (!bugDesc) return;
    await supabase.from("bug_reports").insert({ description: bugDesc, url: window.location.href }).catch(() => {});
    toast({ title: "הבאג דווח ✅ נטפל בו בהקדם" });
    setBugDesc(""); setMode("menu");
  };

  return (
    <div className="fixed bottom-6 left-6 z-50" dir="rtl">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="mb-3 bg-background border rounded-2xl shadow-2xl w-72 overflow-hidden"
          >
            <div className="p-4 border-b bg-primary/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="App2Class" className="h-5 w-5" />
                <span className="font-heading font-bold text-sm">כאן בשבילך</span>
              </div>
              <button onClick={() => { setOpen(false); setMode("menu"); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {mode === "menu" && (
                <>
                  <p className="text-xs text-muted-foreground">איך נוכל לעזור?</p>
                  {[
                    { icon: HelpCircle, label: "שאל את ה-AI", action: () => setMode("ai") },
                    { icon: Bug, label: "דווח על תקלה", action: () => setMode("bug") },
                    { icon: BookOpen, label: "מדריכי שימוש", action: () => window.open("https://docs.app2class.co.il", "_blank") },
                  ].map((item, i) => (
                    <button key={i} onClick={item.action}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-all text-right">
                      <item.icon className="h-4 w-4 text-primary" />
                      <span className="text-sm font-heading">{item.label}</span>
                    </button>
                  ))}
                </>
              )}

              {mode === "ai" && (
                <>
                  <button onClick={() => { setMode("menu"); setAnswer(""); setQuestion(""); }} className="text-xs text-muted-foreground hover:text-foreground">← חזרה</button>
                  {answer ? (
                    <div className="prose prose-sm max-w-none bg-muted/30 rounded-lg p-3 text-xs max-h-40 overflow-y-auto">
                      <ReactMarkdown>{answer}</ReactMarkdown>
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <Input value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === "Enter" && askAI()}
                      placeholder="שאל שאלה על המערכת..." className="text-xs h-9" />
                    <Button size="sm" onClick={askAI} disabled={loading} className="h-9 px-3">
                      {loading ? "..." : "שאל"}
                    </Button>
                  </div>
                </>
              )}

              {mode === "bug" && (
                <>
                  <button onClick={() => setMode("menu")} className="text-xs text-muted-foreground hover:text-foreground">← חזרה</button>
                  <textarea value={bugDesc} onChange={e => setBugDesc(e.target.value)}
                    placeholder="תאר את התקלה שנתקלת בה..." rows={3}
                    className="w-full text-xs p-2 rounded-lg border bg-muted/30 resize-none" />
                  <Button size="sm" className="w-full text-xs font-heading" onClick={reportBug} disabled={!bugDesc}>
                    שלח דיווח
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </motion.button>
    </div>
  );
};

export default FloatingSupportButton;
