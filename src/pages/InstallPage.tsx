import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download, Smartphone, Monitor, CheckCircle, ArrowLeft,
  Share, Plus, MoreVertical,
} from "lucide-react";
import { Link } from "react-router-dom";

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform("ios");
    } else if (/android/.test(ua)) {
      setPlatform("android");
    }

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => setIsInstalled(true);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Zainstaluj NetSys</h1>
            <p className="text-muted-foreground text-sm">
              Zainstaluj aplikację na swoim telefonie
            </p>
          </div>
        </div>
      </div>

      {isInstalled && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-primary" />
            <div>
              <p className="font-medium">Aplikacja zainstalowana!</p>
              <p className="text-sm text-muted-foreground">
                NetSys jest już zainstalowany na tym urządzeniu.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Native install prompt (Android/Desktop Chrome) */}
      {deferredPrompt && !isInstalled && (
        <Card className="mb-6 border-primary/30">
          <CardContent className="py-6 flex flex-col items-center gap-4 text-center">
            <Download className="h-12 w-12 text-primary" />
            <div>
              <p className="text-lg font-semibold">Zainstaluj jednym kliknięciem</p>
              <p className="text-sm text-muted-foreground">
                Dodaj NetSys do ekranu głównego
              </p>
            </div>
            <Button size="lg" onClick={handleInstall} className="min-h-[48px] px-8">
              <Download className="h-5 w-5 mr-2" />
              Zainstaluj aplikację
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {/* iPhone instructions */}
        <Card className={platform === "ios" ? "border-primary/30 ring-2 ring-primary/20" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              iPhone (Safari)
              {platform === "ios" && (
                <Badge variant="default" className="ml-auto">Twoje urządzenie</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
                <div>
                  <p className="font-medium">Otwórz stronę w Safari</p>
                  <p className="text-sm text-muted-foreground">
                    Upewnij się, że używasz przeglądarki Safari (nie Chrome ani innej)
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
                <div>
                  <p className="font-medium flex items-center gap-1.5">
                    Naciśnij przycisk Udostępnij
                    <Share className="h-4 w-4 text-muted-foreground" />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Znajduje się na dole ekranu (kwadrat ze strzałką w górę)
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">3</span>
                <div>
                  <p className="font-medium flex items-center gap-1.5">
                    Wybierz „Dodaj do ekranu początkowego"
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Przewiń listę opcji i naciśnij „Dodaj do ekranu początkowego"
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">4</span>
                <div>
                  <p className="font-medium">Potwierdź nazwę i naciśnij „Dodaj"</p>
                  <p className="text-sm text-muted-foreground">
                    Ikona NetSys pojawi się na ekranie głównym
                  </p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Android instructions */}
        <Card className={platform === "android" ? "border-primary/30 ring-2 ring-primary/20" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Android (Chrome)
              {platform === "android" && (
                <Badge variant="default" className="ml-auto">Twoje urządzenie</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
                <div>
                  <p className="font-medium">Otwórz stronę w Chrome</p>
                  <p className="text-sm text-muted-foreground">
                    Użyj przeglądarki Google Chrome
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
                <div>
                  <p className="font-medium flex items-center gap-1.5">
                    Naciśnij menu (trzy kropki)
                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    W prawym górnym rogu przeglądarki
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">3</span>
                <div>
                  <p className="font-medium">Wybierz „Zainstaluj aplikację" lub „Dodaj do ekranu głównego"</p>
                  <p className="text-sm text-muted-foreground">
                    Chrome może też wyświetlić automatyczny banner instalacji
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">4</span>
                <div>
                  <p className="font-medium">Potwierdź instalację</p>
                  <p className="text-sm text-muted-foreground">
                    Aplikacja NetSys pojawi się wśród zainstalowanych aplikacji
                  </p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Desktop */}
        <Card className={platform === "desktop" ? "border-primary/30 ring-2 ring-primary/20" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Komputer (Chrome / Edge)
              {platform === "desktop" && (
                <Badge variant="default" className="ml-auto">Twoje urządzenie</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Kliknij ikonę instalacji w pasku adresu przeglądarki (ikona ze strzałką w dół lub znakiem +), 
              a następnie potwierdź instalację. Aplikacja otworzy się w osobnym oknie.
            </p>
          </CardContent>
        </Card>

        {/* Benefits */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Dlaczego warto zainstalować?</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span><strong>Szybki dostęp</strong> — otwieraj NetSys jednym kliknięciem z ekranu głównego</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span><strong>Pełny ekran</strong> — aplikacja działa bez paska przeglądarki, jak natywna</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span><strong>Szybsze ładowanie</strong> — zasoby są buforowane na urządzeniu</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span><strong>Skróty</strong> — szybki dostęp do zleceń, magazynu i więcej</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
