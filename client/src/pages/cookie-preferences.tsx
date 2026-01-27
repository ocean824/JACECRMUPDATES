import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft, Cookie, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FooterLegal } from "@/components/footer-legal";

interface CookiePreferences {
  functional: boolean;
  analytics: boolean;
  targeting: boolean;
}

const COOKIE_PREFERENCES_KEY = "jace-cookie-preferences";

const defaultPreferences: CookiePreferences = {
  functional: true,
  analytics: false,
  targeting: false,
};

export default function CookiePreferencesPage() {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<CookiePreferences>(defaultPreferences);

  useEffect(() => {
    const saved = localStorage.getItem(COOKIE_PREFERENCES_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPreferences({
          functional: parsed.functional ?? defaultPreferences.functional,
          analytics: parsed.analytics ?? defaultPreferences.analytics,
          targeting: parsed.targeting ?? defaultPreferences.targeting,
        });
      } catch (e) {
        setPreferences(defaultPreferences);
      }
    }
  }, []);

  const handleToggle = (key: keyof CookiePreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = () => {
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(preferences));
    toast({
      title: "Preferences Saved",
      description: "Your cookie preferences have been updated successfully.",
    });
  };

  const handleAcceptAll = () => {
    const allEnabled: CookiePreferences = {
      functional: true,
      analytics: true,
      targeting: true,
    };
    setPreferences(allEnabled);
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(allEnabled));
    toast({
      title: "All Cookies Accepted",
      description: "All cookie categories have been enabled.",
    });
  };

  const handleRejectAll = () => {
    const allDisabled: CookiePreferences = {
      functional: false,
      analytics: false,
      targeting: false,
    };
    setPreferences(allDisabled);
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(allDisabled));
    toast({
      title: "Non-Essential Cookies Rejected",
      description: "Only strictly necessary cookies will be used.",
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" asChild data-testid="button-back-home">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Home
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl flex items-center gap-3">
                <Cookie className="h-8 w-8 text-muted-foreground" />
                Cookie Preferences
              </CardTitle>
              <p className="text-muted-foreground">
                Manage your cookie settings and control how we use cookies on our website.
              </p>
            </CardHeader>
            <CardContent className="space-y-8">
              <section>
                <p className="text-muted-foreground leading-relaxed">
                  We use cookies and similar technologies to provide, protect, and improve our services. 
                  You can customize your cookie preferences below. For more information, please see our{" "}
                  <Link href="/privacy-policy" className="underline hover:no-underline">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </section>

              <section className="space-y-6">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Label className="font-medium">Strictly Necessary Cookies</Label>
                        <span className="text-xs bg-primary/10 text-muted-foreground px-2 py-0.5 rounded">
                          Always Active
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        These cookies are essential for the website to function properly. They enable 
                        core functionality such as security, network management, and account access. 
                        You cannot disable these cookies.
                      </p>
                    </div>
                    <Switch checked={true} disabled className="shrink-0" />
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <Label htmlFor="functional" className="font-medium cursor-pointer">
                        Functional Cookies
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        These cookies enable personalized features and remember your preferences, such 
                        as language selection, region, and display settings. They enhance your experience 
                        but are not essential for the website to work.
                      </p>
                    </div>
                    <Switch
                      id="functional"
                      checked={preferences.functional}
                      onCheckedChange={() => handleToggle("functional")}
                      className="shrink-0"
                      data-testid="switch-functional"
                    />
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <Label htmlFor="analytics" className="font-medium cursor-pointer">
                        Analytics Cookies
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        These cookies help us understand how visitors interact with our website by 
                        collecting and reporting information anonymously. This helps us improve our 
                        website and services.
                      </p>
                    </div>
                    <Switch
                      id="analytics"
                      checked={preferences.analytics}
                      onCheckedChange={() => handleToggle("analytics")}
                      className="shrink-0"
                      data-testid="switch-analytics"
                    />
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <Label htmlFor="targeting" className="font-medium cursor-pointer">
                        Targeting/Advertising Cookies
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        These cookies are used to deliver relevant advertisements and track campaign 
                        performance. They may be set by our advertising partners to build a profile of 
                        your interests and show you relevant ads on other sites.
                      </p>
                    </div>
                    <Switch
                      id="targeting"
                      checked={preferences.targeting}
                      onCheckedChange={() => handleToggle("targeting")}
                      className="shrink-0"
                      data-testid="switch-targeting"
                    />
                  </div>
                </div>
              </section>

              <section className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={handleSave} 
                  className="flex-1"
                  data-testid="button-save-preferences"
                >
                  Save Preferences
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleAcceptAll}
                  data-testid="button-accept-all"
                >
                  Accept All
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleRejectAll}
                  data-testid="button-reject-all"
                >
                  Reject All
                </Button>
              </section>

              <section className="pt-4 border-t">
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-2">
                      <strong className="text-foreground">Note:</strong> Changes to your cookie 
                      preferences will take effect immediately. Some cookies may remain on your device 
                      until they expire or you clear your browser data.
                    </p>
                    <p>
                      If you have any questions about how we use cookies, please contact us at{" "}
                      <a 
                        href="mailto:jacemgmt@gmail.com" 
                        className="underline hover:no-underline"
                      >
                        jacemgmt@gmail.com
                      </a>
                      .
                    </p>
                  </div>
                </div>
              </section>
            </CardContent>
          </Card>
        </div>
      </main>

      <FooterLegal />
    </div>
  );
}
