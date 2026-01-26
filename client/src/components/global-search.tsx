import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Users,
  ClipboardList,
  Landmark,
  FileText,
  Calendar,
  Loader2,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Investor, Task, BondSettlement, Document } from "@shared/schema";
import { pipelineStages } from "@shared/schema";

interface SearchResults {
  investors: Investor[];
  tasks: Task[];
  bonds: BondSettlement[];
  documents: Document[];
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function getPipelineStageBadge(stage: string) {
  const stageInfo = pipelineStages.find((s) => s.value === stage);
  if (!stageInfo) return null;
  return (
    <Badge variant="secondary" className="text-xs">
      {stageInfo.label}
    </Badge>
  );
}

function getStatusBadge(status: string | null) {
  if (!status) return null;
  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    in_progress: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    completed: "bg-green-500/10 text-green-600 border-green-500/20",
    cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
  };
  return (
    <Badge variant="outline" className={`text-xs ${statusColors[status] || ""}`}>
      {status.replace("_", " ")}
    </Badge>
  );
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

function formatCurrency(value: string | null | undefined): string {
  if (!value) return "";
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({
    investors: [],
    tasks: [],
    bonds: [],
    documents: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults({ investors: [], tasks: [], bonds: [], documents: [] });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest(
        "GET",
        `/api/search?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error("Search error:", error);
      setResults({ investors: [], tasks: [], bonds: [], documents: [] });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch]);

  const handleSelect = (type: string, id: string) => {
    setOpen(false);
    setQuery("");
    switch (type) {
      case "investor":
        setLocation("/investors");
        break;
      case "task":
        setLocation("/tasks");
        break;
      case "bond":
        setLocation("/bonds");
        break;
      case "document":
        setLocation("/documents");
        break;
    }
  };

  const hasResults =
    results.investors.length > 0 ||
    results.tasks.length > 0 ||
    results.bonds.length > 0 ||
    results.documents.length > 0;

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-9 p-0 xl:h-9 xl:w-60 xl:justify-start xl:px-3 xl:py-2"
        onClick={() => setOpen(true)}
        data-testid="button-global-search"
      >
        <Search className="h-4 w-4 xl:mr-2" />
        <span className="hidden xl:inline-flex">Search...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 xl:flex">
          <span className="text-xs">Ctrl</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search investors, tasks, bonds, documents..."
          value={query}
          onValueChange={setQuery}
          data-testid="input-global-search"
        />
        <CommandList>
          {isLoading && (
            <div className="py-6 flex items-center justify-center" data-testid="search-loading">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && query.length >= 2 && !hasResults && (
            <CommandEmpty data-testid="search-no-results">No results found.</CommandEmpty>
          )}

          {!isLoading && query.length < 2 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search...
            </div>
          )}

          {!isLoading && results.investors.length > 0 && (
            <CommandGroup heading="Investors" data-testid="search-group-investors">
              {results.investors.map((investor) => (
                <CommandItem
                  key={investor.id}
                  value={`investor-${investor.id}`}
                  onSelect={() => handleSelect("investor", investor.id)}
                  className="cursor-pointer"
                  data-testid={`search-result-investor-${investor.id}`}
                >
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {investor.firstName} {investor.lastName}
                      </span>
                      {getPipelineStageBadge(investor.pipelineStage)}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {investor.email}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!isLoading && results.tasks.length > 0 && (
            <CommandGroup heading="Tasks" data-testid="search-group-tasks">
              {results.tasks.map((task) => (
                <CommandItem
                  key={task.id}
                  value={`task-${task.id}`}
                  onSelect={() => handleSelect("task", task.id)}
                  className="cursor-pointer"
                  data-testid={`search-result-task-${task.id}`}
                >
                  <ClipboardList className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{task.title}</span>
                      {getStatusBadge(task.status)}
                    </div>
                    {task.dueDate && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Due: {formatDate(task.dueDate)}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!isLoading && results.bonds.length > 0 && (
            <CommandGroup heading="Bonds" data-testid="search-group-bonds">
              {results.bonds.map((bond) => (
                <CommandItem
                  key={bond.id}
                  value={`bond-${bond.id}`}
                  onSelect={() => handleSelect("bond", bond.id)}
                  className="cursor-pointer"
                  data-testid={`search-result-bond-${bond.id}`}
                >
                  <Landmark className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="font-medium">{bond.bondName}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {bond.isin && <span>ISIN: {bond.isin}</span>}
                      {bond.faceValue && (
                        <span>Face Value: {formatCurrency(bond.faceValue)}</span>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!isLoading && results.documents.length > 0 && (
            <CommandGroup heading="Documents" data-testid="search-group-documents">
              {results.documents.map((doc) => (
                <CommandItem
                  key={doc.id}
                  value={`document-${doc.id}`}
                  onSelect={() => handleSelect("document", doc.id)}
                  className="cursor-pointer"
                  data-testid={`search-result-document-${doc.id}`}
                >
                  <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="font-medium">{doc.originalName}</span>
                    {doc.category && (
                      <span className="text-xs text-muted-foreground">
                        Category: {doc.category}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
