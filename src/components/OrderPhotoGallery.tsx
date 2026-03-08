import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Trash2, Download, Camera, X, ZoomIn } from "lucide-react";

interface OrderPhoto {
  id: string;
  order_id: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  caption: string | null;
  created_at: string;
}

export function OrderPhotoGallery({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletePhoto, setDeletePhoto] = useState<OrderPhoto | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["order-photos", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_order_photos" as any)
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as OrderPhoto[];
    },
    enabled: !!orderId,
  });

  function getPublicUrl(filePath: string) {
    const { data } = supabase.storage.from("order-photos").getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} nie jest obrazem`);
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} jest za duży (max 10MB)`);
          continue;
        }

        const ext = file.name.split(".").pop() || "jpg";
        const filePath = `${orderId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("order-photos")
          .upload(filePath, file, { contentType: file.type });
        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
          .from("service_order_photos" as any)
          .insert({
            order_id: orderId,
            file_path: filePath,
            file_name: file.name,
            file_size: file.size,
            uploaded_by: user?.id,
          });
        if (dbError) throw dbError;
      }
      queryClient.invalidateQueries({ queryKey: ["order-photos", orderId] });
      toast.success(`Dodano ${files.length} zdjęć`);
    } catch (err: any) {
      toast.error(err?.message || "Błąd przesyłania");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async (photo: OrderPhoto) => {
      await supabase.storage.from("order-photos").remove([photo.file_path]);
      const { error } = await supabase
        .from("service_order_photos" as any)
        .delete()
        .eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-photos", orderId] });
      setDeletePhoto(null);
      toast.success("Zdjęcie usunięte");
    },
    onError: () => toast.error("Błąd usuwania"),
  });

  function handleDownload(photo: OrderPhoto) {
    const url = getPublicUrl(photo.file_path);
    const a = document.createElement("a");
    a.href = url;
    a.download = photo.file_name;
    a.target = "_blank";
    a.click();
  }

  return (
    <div className="space-y-4">
      {/* Upload */}
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Przesyłanie..." : "Dodaj zdjęcia"}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.capture = "environment";
            input.onchange = (e) => handleUpload((e.target as HTMLInputElement).files);
            input.click();
          }}
          disabled={uploading}
        >
          <Camera className="h-4 w-4 mr-2" />
          Zrób zdjęcie
        </Button>
        <span className="text-xs text-muted-foreground">
          {photos.length} zdjęć
        </span>
      </div>

      {/* Gallery */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Ładowanie zdjęć...</p>
      ) : photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak zdjęć. Dodaj zdjęcia stanu urządzenia.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {photos.map((photo) => {
            const url = getPublicUrl(photo.file_path);
            return (
              <Card key={photo.id} className="group relative overflow-hidden">
                <img
                  src={url}
                  alt={photo.file_name}
                  className="w-full h-32 object-cover cursor-pointer"
                  onClick={() => setPreviewUrl(url)}
                />
                <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setPreviewUrl(url)}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(photo)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeletePhoto(photo)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="p-1.5">
                  <p className="text-xs truncate text-muted-foreground">{photo.file_name}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Preview dialog */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => { if (!open) setPreviewUrl(null); }}>
        <DialogContent className="max-w-4xl p-2">
          {previewUrl && (
            <img src={previewUrl} alt="Podgląd" className="w-full h-auto max-h-[80vh] object-contain rounded" />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deletePhoto} onOpenChange={(open) => { if (!open) setDeletePhoto(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć zdjęcie?</AlertDialogTitle>
            <AlertDialogDescription>
              Zdjęcie „{deletePhoto?.file_name}" zostanie trwale usunięte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletePhoto && deleteMutation.mutate(deletePhoto)}>
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
