import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useLocation } from "wouter";

interface NavigationContextType {
  previousPath: string | null;
  currentPath: string;
  navigateTo: (path: string) => void;
  goBack: () => void;
  getBackPath: () => string;
  getBackLabel: () => string;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

// Define navigation hierarchy for contextual back buttons
const navigationHierarchy: Record<string, { parent: string; label: string }> = {
  // Investors section
  "/investors": { parent: "/", label: "Dashboard" },
  "/pipeline": { parent: "/investors", label: "Investors" },
  
  // Financial section
  "/invoices": { parent: "/", label: "Dashboard" },
  "/quotes": { parent: "/invoices", label: "Invoices" },
  "/expenses": { parent: "/", label: "Dashboard" },
  "/escrow": { parent: "/", label: "Dashboard" },
  
  // Accounting section
  "/accounts": { parent: "/", label: "Dashboard" },
  "/journal": { parent: "/accounts", label: "Accounts" },
  "/bonds": { parent: "/", label: "Dashboard" },
  
  // Reports section
  "/reports/trial-balance": { parent: "/accounts", label: "Accounts" },
  "/reports/income-statement": { parent: "/accounts", label: "Accounts" },
  "/reports/balance-sheet": { parent: "/accounts", label: "Accounts" },
  
  // HR section
  "/employees": { parent: "/", label: "Dashboard" },
  "/departments": { parent: "/employees", label: "Employees" },
  "/time-tracking": { parent: "/employees", label: "Employees" },
  "/leave-requests": { parent: "/employees", label: "Employees" },
  "/payroll": { parent: "/employees", label: "Employees" },
  
  // Tasks section
  "/tasks": { parent: "/", label: "Dashboard" },
  "/recurring-tasks": { parent: "/tasks", label: "Tasks" },
  "/calendar": { parent: "/", label: "Dashboard" },
  
  // Compliance section
  "/kyc": { parent: "/investors", label: "Investors" },
  "/documents": { parent: "/", label: "Dashboard" },
  "/communications": { parent: "/investors", label: "Investors" },
  "/email": { parent: "/communications", label: "Communications" },
  
  // Analytics & Admin
  "/analytics": { parent: "/", label: "Dashboard" },
  "/audit-logs": { parent: "/", label: "Dashboard" },
  "/admin": { parent: "/", label: "Dashboard" },
  "/settings": { parent: "/", label: "Dashboard" },
  "/custom-fields": { parent: "/settings", label: "Settings" },
  "/import": { parent: "/", label: "Dashboard" },
  
  // Integrations
  "/integrations/bondai": { parent: "/", label: "Dashboard" },
  
  // Investor portal
  "/investor-portal": { parent: "/investors", label: "Investors" },
};

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [previousPath, setPreviousPath] = useState<string | null>(null);

  const navigateTo = useCallback((path: string) => {
    setPreviousPath(location);
    setLocation(path);
  }, [location, setLocation]);

  const getBackPath = useCallback((): string => {
    // Check if we have a defined hierarchy for current path
    const hierarchy = navigationHierarchy[location];
    if (hierarchy) {
      return hierarchy.parent;
    }
    
    // Check for dynamic routes (e.g., /investors/:id)
    if (location.startsWith("/investors/") && location !== "/investors") {
      return "/investors";
    }
    if (location.startsWith("/compliance/")) {
      return "/investors";
    }
    
    // Default to dashboard
    return "/";
  }, [location]);

  const getBackLabel = useCallback((): string => {
    const hierarchy = navigationHierarchy[location];
    if (hierarchy) {
      return hierarchy.label;
    }
    
    // Check for dynamic routes
    if (location.startsWith("/investors/") && location !== "/investors") {
      return "Investors";
    }
    if (location.startsWith("/compliance/")) {
      return "Investors";
    }
    
    return "Dashboard";
  }, [location]);

  const goBack = useCallback(() => {
    const backPath = getBackPath();
    setLocation(backPath);
  }, [getBackPath, setLocation]);

  return (
    <NavigationContext.Provider
      value={{
        previousPath,
        currentPath: location,
        navigateTo,
        goBack,
        getBackPath,
        getBackLabel,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return context;
}
