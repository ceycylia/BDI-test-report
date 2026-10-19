import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Download } from "lucide-react";
import { adminDownload, AdminApiError } from "../admin-auth/admin-api";

type DownloadJobStatus = "preparing" | "completed" | "failed";

type DownloadJob = {
  key: string;
  label: string;
  status: DownloadJobStatus;
  message: string;
};

type StartDownloadInput = {
  key: string;
  label: string;
  fileName: string;
  path: string;
  init: RequestInit;
};

type DownloadManagerValue = {
  jobs: Record<string, DownloadJob>;
  startDownload: (input: StartDownloadInput) => Promise<void>;
};

const DownloadManagerContext = createContext<DownloadManagerValue | null>(null);

export function DownloadManagerProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Record<string, DownloadJob>>({});
  const activeKeys = useRef(new Set<string>());
  const dismissalTimers = useRef<Record<string, number>>({});

  useEffect(() => () => {
    Object.values(dismissalTimers.current).forEach((timer) => window.clearTimeout(timer));
  }, []);

  const dismissLater = useCallback((key: string) => {
    window.clearTimeout(dismissalTimers.current[key]);
    dismissalTimers.current[key] = window.setTimeout(() => {
      setJobs((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      delete dismissalTimers.current[key];
    }, 7000);
  }, []);

  const startDownload = useCallback(async (input: StartDownloadInput) => {
    if (activeKeys.current.has(input.key)) return;
    activeKeys.current.add(input.key);
    window.clearTimeout(dismissalTimers.current[input.key]);
    setJobs((current) => ({
      ...current,
      [input.key]: {
        key: input.key,
        label: input.label,
        status: "preparing",
        message: `Menyiapkan ${input.label.toLocaleLowerCase("id-ID")}… Anda dapat membuka menu lain.`,
      },
    }));

    try {
      const archive = await adminDownload(input.path, input.init);
      const url = URL.createObjectURL(archive);
      const link = document.createElement("a");
      link.href = url;
      link.download = input.fileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setJobs((current) => ({
        ...current,
        [input.key]: {
          key: input.key,
          label: input.label,
          status: "completed",
          message: `${input.label} selesai dan sudah diunduh.`,
        },
      }));
    } catch (reason) {
      const message = reason instanceof AdminApiError
        ? reason.message
        : `${input.label} tidak dapat disiapkan.`;
      setJobs((current) => ({
        ...current,
        [input.key]: {
          key: input.key,
          label: input.label,
          status: "failed",
          message,
        },
      }));
    } finally {
      activeKeys.current.delete(input.key);
      dismissLater(input.key);
    }
  }, [dismissLater]);

  return (
    <DownloadManagerContext.Provider value={{ jobs, startDownload }}>
      {children}
      <div className="global-download-jobs" aria-live="polite">
        {Object.values(jobs).map((job) => (
          <div
            key={job.key}
            className={`global-download-job is-${job.status}`}
            role={job.status === "failed" ? "alert" : "status"}
          >
            <Download aria-hidden="true" />
            <span>{job.message}</span>
          </div>
        ))}
      </div>
    </DownloadManagerContext.Provider>
  );
}

export function useDownloadManager() {
  const context = useContext(DownloadManagerContext);
  if (!context) throw new Error("useDownloadManager harus digunakan di dalam DownloadManagerProvider.");
  return context;
}
