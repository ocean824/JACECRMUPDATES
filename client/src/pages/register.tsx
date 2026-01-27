import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, UserPlus, Building2, CheckCircle, KeyRound } from "lucide-react";
import { Link } from "wouter";

export default function RegisterPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<"form" | "pending" | "approved">("form");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [pinData, setPinData] = useState({
    email: "",
    pin: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.name === "pin" 
      ? e.target.value.toLowerCase().slice(0, 9) 
      : e.target.value;
    setPinData({ ...pinData, [e.target.name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/register", {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
      });
      const data = await response.json();
      
      if (data.status === "pending") {
        setRegistrationStatus("pending");
        setPinData({ ...pinData, email: formData.email });
        toast({
          title: "Registration Submitted",
          description: "Please wait for admin approval. You will receive an email with your PIN.",
        });
      } else if (data.status === "approved") {
        setRegistrationStatus("approved");
        setPinData({ ...pinData, email: formData.email });
        toast({
          title: "Already Approved",
          description: "Your registration was already approved. Check your email for your PIN.",
        });
      }
    } catch (error: any) {
      const message = error.message || "Failed to submit registration";
      if (message.includes("pending")) {
        setRegistrationStatus("pending");
        setPinData({ ...pinData, email: formData.email });
      } else if (message.includes("approved")) {
        setRegistrationStatus("approved");
        setPinData({ ...pinData, email: formData.email });
      } else {
        toast({
          title: "Registration Failed",
          description: message,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (pinData.pin.length < 1 || pinData.pin.length > 9) {
      toast({
        title: "Error",
        description: "Please enter a valid invite PIN",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/complete-registration", {
        email: pinData.email,
        pin: pinData.pin,
      });
      toast({
        title: "Success",
        description: "Account created successfully!",
      });
      window.location.href = "/";
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid email or PIN",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (registrationStatus === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500">
              <CheckCircle className="h-7 w-7 text-white" />
            </div>
            <CardTitle className="text-2xl">Registration Pending</CardTitle>
            <CardDescription>
              Your registration is awaiting admin approval
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-muted-foreground">
              <p>An administrator has been notified of your registration request.</p>
              <p className="mt-2">Once approved, you will receive an email with a unique PIN to complete your registration.</p>
            </div>
            
            <div className="pt-4 border-t">
              <p className="text-sm text-center text-muted-foreground mb-4">
                Already received your PIN?
              </p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setRegistrationStatus("approved")}
                data-testid="button-enter-pin"
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Enter PIN
              </Button>
            </div>
            
            <div className="text-center">
              <Link href="/login" className="text-sm text-primary hover:underline" data-testid="link-login">
                Back to Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (registrationStatus === "approved") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500">
              <KeyRound className="h-7 w-7 text-white" />
            </div>
            <CardTitle className="text-2xl">Enter Your PIN</CardTitle>
            <CardDescription>
              Complete your registration with the PIN sent to your email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="john@example.com"
                  value={pinData.email}
                  onChange={handlePinChange}
                  required
                  data-testid="input-pin-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pin">Invite PIN</Label>
                <Input
                  id="pin"
                  name="pin"
                  type="text"
                  placeholder="Enter your invite PIN"
                  value={pinData.pin}
                  onChange={handlePinChange}
                  maxLength={9}
                  className="text-center text-lg tracking-wider font-mono"
                  required
                  data-testid="input-pin"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Check your email for the invite PIN (expires in 2 hours)
                </p>
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
                data-testid="button-verify-pin"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Complete Registration
                  </>
                )}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <Link href="/login" className="text-sm text-primary hover:underline" data-testid="link-login">
                Back to Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary">
            <Building2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>
            Join JACE CRM to manage your investor relations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  data-testid="input-first-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  data-testid="input-last-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="At least 8 characters"
                value={formData.password}
                onChange={handleChange}
                required
                data-testid="input-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                data-testid="input-confirm-password"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
              data-testid="button-register"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Request Account
                </>
              )}
            </Button>
          </form>
          
          <div className="mt-4 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
            <p>Account creation requires admin approval. Once approved, you'll receive a unique PIN via email to complete registration.</p>
          </div>
          
          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link href="/login" className="text-primary hover:underline" data-testid="link-login">
              Sign in
            </Link>
          </div>
          
          <div className="mt-2 text-center text-sm">
            <span className="text-muted-foreground">Have a PIN? </span>
            <button 
              onClick={() => setRegistrationStatus("approved")}
              className="text-primary hover:underline"
              data-testid="link-have-pin"
            >
              Complete registration
            </button>
          </div>
          
          <div className="mt-4 pt-4 border-t text-center">
            <Link 
              href="/admin-login" 
              className="text-sm text-muted-foreground hover:text-foreground"
              data-testid="link-admin-portal"
            >
              Admin Portal
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
