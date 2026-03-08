import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Camera, MessageSquare, Mic, MicOff, Send, Wrench, Image } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileQuickActionsProps {
  orderId: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function MobileQuickActions({ orderId, activeTab, setActiveTab }: MobileQuickActionsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [quickComment, setQuickComment] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [uploading, setUploading] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Speech Recognition setup
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Dyktowanie nie jest obsługiwane w tej przeglądarce");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "pl-PL";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setQuickComment(transcript);
    };
    recognition.onerror = () => {
      setIsListening(false);
      toast.error("Błąd rozpoznawania mowy");
    };
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  // Quick comment mutation
  const addComment = useMutation({
    mutationFn: async () => {
      if (!quickComment.trim()) return;
      const { error } = await supabase.from("service_order_comments").insert({
        order_id: orderId, user_id: user?.id, comment: quickComment.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-comments", orderId] });
      setQuickComment("");
      setCommentOpen(false);
      stopListening();
      toast.success("Komentarz dodany");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Photo upload handler
  async function handlePhotoUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) { toast.error(`${file.name} nie jest obrazem`); continue; }
        if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} za duży (max 10MB)`); continue; }
        const ext = file.name.split(".").pop() || "jpg";
        const filePath = `${orderId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("order-photos").upload(filePath, file, { contentType: file.type });
        if (uploadError) throw uploadError;
        const { error: dbError } = await supabase.from("service_order_photos" as any).insert({
          order_id: orderId, file_path: filePath, file_name: file.name, file_size: file.size, uploaded_by: user?.id,
        });
        if (dbError) throw dbError;
      }
      queryClient.invalidateQueries({ queryKey: ["order-photos", orderId] });
      toast.success("Zdjęcie dodane");
    } catch (err: any) {
      toast.error(err?.message || "Błąd przesyłania");
    } finally {
      setUploading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  }

  return (
    <>
      {/* Hidden file inputs */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoUpload(e.target.files)} />
      <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handlePhotoUpload(e.target.files)} />

      {/* Floating bar */}
      <div className="fixed bottom-[56px] left-0 right-0 z-40 md:hidden bg-card/95 backdrop-blur-sm border-t border-border px-2 py-1.5 safe-area-bottom">
        <div className="flex items-center justify-around gap-0.5">
          <button
            className="flex flex-col items-center gap-0.5 p-2 rounded-lg active:bg-accent min-w-[52px]"
            onClick={() => { setActiveTab("edit"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          >
            <Wrench className={cn("h-5 w-5", activeTab === "edit" ? "text-primary" : "text-muted-foreground")} />
            <span className="text-[10px] text-muted-foreground">Status</span>
          </button>

          <button
            className="flex flex-col items-center gap-0.5 p-2 rounded-lg active:bg-accent min-w-[52px]"
            onClick={() => setCommentOpen(true)}
          >
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Notatka</span>
          </button>

          {/* Camera - primary action, larger */}
          <button
            className="flex flex-col items-center gap-0.5 p-2.5 rounded-xl bg-primary/10 active:bg-primary/20 min-w-[56px]"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="h-6 w-6 text-primary" />
            <span className="text-[10px] font-medium text-primary">{uploading ? "..." : "Zdjęcie"}</span>
          </button>

          <button
            className="flex flex-col items-center gap-0.5 p-2 rounded-lg active:bg-accent min-w-[52px]"
            onClick={() => galleryInputRef.current?.click()}
            disabled={uploading}
          >
            <Image className="h-5 w-5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Galeria</span>
          </button>

          <button
            className="flex flex-col items-center gap-0.5 p-2 rounded-lg active:bg-accent min-w-[52px]"
            onClick={() => setActiveTab("customer-messages")}
          >
            <Send className={cn("h-5 w-5", activeTab === "customer-messages" ? "text-primary" : "text-muted-foreground")} />
            <span className="text-[10px] text-muted-foreground">Klient</span>
          </button>
        </div>
      </div>

      {/* Quick comment dialog */}
      <Dialog open={commentOpen} onOpenChange={(open) => { if (!open) { stopListening(); } setCommentOpen(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Szybki komentarz</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Textarea
                placeholder="Wpisz komentarz lub użyj dyktowania..."
                value={quickComment}
                onChange={(e) => setQuickComment(e.target.value)}
                rows={4}
                className="pr-12 text-base"
              />
              <Button
                type="button"
                variant={isListening ? "destructive" : "ghost"}
                size="icon"
                className={cn(
                  "absolute right-2 top-2 h-9 w-9",
                  isListening && "animate-pulse"
                )}
                onClick={isListening ? stopListening : startListening}
              >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
            </div>
            {isListening && (
              <p className="text-xs text-primary flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                Słucham... mów teraz
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setCommentOpen(false); stopListening(); setQuickComment(""); }}>
                Anuluj
              </Button>
              <Button
                onClick={() => addComment.mutate()}
                disabled={!quickComment.trim() || addComment.isPending}
                className="min-w-[100px]"
              >
                <Send className="h-4 w-4 mr-1" />
                {addComment.isPending ? "Wysyłanie..." : "Dodaj"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom spacer */}
      <div className="h-16 md:hidden" />
    </>
  );
}
