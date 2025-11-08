import React, { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSearchParams } from "react-router-dom";
import type { Job } from "@/components/JobStatusCard";

const RegisterVault: React.FC = () => {
  const { toast } = useToast();
  const [uploadPath, setUploadPath] = useState<string | null>(null);
  const [filesUploading, setFilesUploading] = useState(false);
  const [csvUploading, setCsvUploading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const jobIdParam = searchParams.get("jobId") || undefined;
    setSelectedJobId(jobIdParam);
  }, [searchParams]);

  useEffect(() => {
    const fetchJobs = async () => {
      setLoadingJobs(true);
      try {
        const response = await fetch("/api/jobs");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.error || "Failed to fetch jobs");
        setJobs(data.jobs || []);
      } catch (err: any) {
        console.error("Error fetching jobs:", err);
        toast({ title: "Error", description: "Failed to load jobs", variant: "destructive" });
      } finally {
        setLoadingJobs(false);
      }
    };
    fetchJobs();
  }, [toast]);

  const completedJobs = useMemo(() => jobs.filter(j => j.status === "COMPLETED"), [jobs]);

  const handleFilesUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("vaultFiles") as HTMLInputElement | null;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      toast({ title: "No files selected", description: "Please choose Excel and/or image files." });
      return;
    }
    try {
      setFilesUploading(true);
      const fd = new FormData();
      Array.from(fileInput.files).forEach((f) => fd.append("files[]", f));
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const data = await res.json();
      setUploadPath(data.uploadPath || data.path || null);
      toast({ title: "Files uploaded", description: "Stored for Vault registration." });
    } catch (err: any) {
      toast({ title: "Upload error", description: err.message, variant: "destructive" });
    } finally {
      setFilesUploading(false);
    }
  };

  const handleCsvUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("vaultCsv") as HTMLInputElement | null;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      toast({ title: "No CSV selected", description: "Please choose a CSV file." });
      return;
    }
    try {
      setCsvUploading(true);
      const fd = new FormData();
      Array.from(fileInput.files).forEach((f) => fd.append("files[]", f));
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const data = await res.json();
      setUploadPath(data.uploadPath || data.path || null);
      toast({ title: "CSV uploaded", description: "Stored for Vault registration." });
    } catch (err: any) {
      toast({ title: "Upload error", description: err.message, variant: "destructive" });
    } finally {
      setCsvUploading(false);
    }
  };

  const handleRegisterSelectedJob = async () => {
    if (!selectedJobId) {
      toast({ title: "No job selected", description: "Please choose a job to register." });
      return;
    }
    try {
      // Placeholder: call backend vault registration endpoint (to be implemented)
      const res = await fetch(`/api/vault/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJobId }),
      });
      if (!res.ok) {
        // If endpoint doesn't exist yet, inform the user gracefully
        throw new Error("Vault registration endpoint not available yet");
      }
      const data = await res.json();
      if (data.success) {
        toast({ title: "Registered", description: `Job ${selectedJobId.slice(0,8)} registered to Vault` });
      } else {
        throw new Error(data.error || "Registration failed");
      }
    } catch (err: any) {
      toast({
        title: "Vault registration pending",
        description: err.message || "The backend endpoint will be added later. UI selection saved.",
      });
    }
  };

  return (
    <AppLayout title="Register Vault">
      <div className="space-y-6">
        <p className="text-muted-foreground text-sm">
          This page will register uploaded Excel & images to the Vault system, or accept a CSV. Details of the Vault API will be added later.
        </p>

        {/* Select a processed job to register */}
        <Card>
          <CardHeader>
            <CardTitle>Select Job to Register</CardTitle>
            <CardDescription>Choose a completed job from ID Card Processor to register into Vault</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Completed Jobs</label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger disabled={loadingJobs}>
                    <SelectValue placeholder={loadingJobs ? "Loading jobs..." : "Select a job"} />
                  </SelectTrigger>
                  <SelectContent>
                    {completedJobs.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No completed jobs</div>
                    ) : (
                      completedJobs.map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          Job {j.id.slice(0, 8)} • {j.type === 'IMAGES_ONLY' ? 'Images Only' : 'Images & Excel'}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button onClick={handleRegisterSelectedJob} disabled={!selectedJobId} className="w-full sm:w-auto">
                  Register Selected Job to Vault
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Register Excel & Images</CardTitle>
              <CardDescription>Upload Excel (.xls/.xlsx) and image files to prepare for Vault registration</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleFilesUpload}>
                <div className="space-y-2">
                  <label htmlFor="vaultFiles" className="text-sm font-medium">Select Files</label>
                  <Input id="vaultFiles" name="vaultFiles" type="file" multiple accept=".xls,.xlsx,image/*" />
                </div>
                <Button type="submit" disabled={filesUploading}>
                  {filesUploading ? "Uploading..." : "Upload to Vault"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upload CSV</CardTitle>
              <CardDescription>Optionally upload a CSV to register to Vault</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleCsvUpload}>
                <div className="space-y-2">
                  <label htmlFor="vaultCsv" className="text-sm font-medium">Select CSV</label>
                  <Input id="vaultCsv" name="vaultCsv" type="file" accept=".csv" />
                </div>
                <Button type="submit" disabled={csvUploading}>
                  {csvUploading ? "Uploading..." : "Upload CSV"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {uploadPath && (
          <div className="text-sm text-muted-foreground">
            Upload stored at: <span className="font-mono">{uploadPath}</span>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default RegisterVault;