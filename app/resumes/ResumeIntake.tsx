"use client";

import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  LoaderCircle,
  LogIn,
  LogOut,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  currentMicrosoftAccount,
  microsoftAccessToken,
  signInToMicrosoft,
  signOutOfMicrosoft,
  type MicrosoftAccount,
} from "@/lib/microsoft-auth";

type ParsedResume = {
  studentName: string;
  address: string;
  program: string;
  graduationDate: string;
  fileNameValid: boolean;
  fileNameError: string;
  skills: string[];
  certifications: string[];
};

type UploadRecord = ParsedResume & {
  id: string;
  file: File;
  needsGraduationDate: boolean;
  status: "parsing" | "ready" | "error" | "saving" | "saved";
  error?: string;
};

type StoredResume = {
  id: string;
  name: string;
  webUrl: string;
  studentName: string;
  address: string;
  location: string;
  program: string;
  graduationDate: string;
  status: string;
};

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx"];

function acceptedFile(file: File) {
  const lower = file.name.toLowerCase();
  return file.size <= MAX_FILE_BYTES
    && ACCEPTED_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function monthLabel(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}-01T12:00:00Z`));
}

function unique(items: string[]) {
  return [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export default function ResumeIntake() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [resumes, setResumes] = useState<StoredResume[]>([]);
  const [programs, setPrograms] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [microsoftAccount, setMicrosoftAccount] = useState<MicrosoftAccount | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  async function loadLibrary(accessToken: string) {
    setLoadingLibrary(true);
    setLoadError("");
    try {
      const response = await fetch("/api/resumes", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Saved resumes could not be loaded.");
      setResumes(Array.isArray(data.resumes) ? data.resumes : []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Saved resumes could not be loaded.");
    } finally {
      setLoadingLibrary(false);
    }
  }

  useEffect(() => {
    fetch("/api/resumes/config")
      .then((response) => response.json())
      .then((data) => setPrograms(Array.isArray(data.programs) ? data.programs : []))
      .catch(() => undefined);
    void (async () => {
      try {
        const account = await currentMicrosoftAccount();
        setMicrosoftAccount(account);
        if (account) {
          const token = await microsoftAccessToken(account, false);
          if (token) {
            await loadLibrary(token);
          } else {
            setMicrosoftAccount(null);
            setLoadingLibrary(false);
          }
        } else {
          setLoadingLibrary(false);
        }
      } catch (error) {
        setLoadingLibrary(false);
        setLoadError(error instanceof Error ? error.message : "Microsoft sign-in could not be restored.");
      }
    })();
  }, []);

  async function connectMicrosoft() {
    setAuthBusy(true);
    setLoadError("");
    try {
      const account = await signInToMicrosoft();
      setMicrosoftAccount(account);
      const token = await microsoftAccessToken(account);
      await loadLibrary(token);
      return { account, token };
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Microsoft sign-in failed.");
      return null;
    } finally {
      setAuthBusy(false);
    }
  }

  function updateUpload(id: string, patch: Partial<UploadRecord>) {
    setUploads((current) =>
      current.map((record) => (record.id === id ? { ...record, ...patch } : record)),
    );
  }

  async function parseUpload(record: UploadRecord) {
    const body = new FormData();
    body.append("file", record.file);
    try {
      const response = await fetch("/api/resumes/parse", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "This resume could not be read.");
      updateUpload(record.id, {
        ...data.resume,
        needsGraduationDate: !data.resume.graduationDate,
        status: "ready",
      });
    } catch (error) {
      updateUpload(record.id, {
        status: "error",
        error: error instanceof Error ? error.message : "This resume could not be read.",
      });
    }
  }

  function addFiles(files: File[]) {
    setMessage("");
    const existing = new Set(uploads.map((record) => `${record.file.name}-${record.file.size}`));
    const records: UploadRecord[] = [];
    let skipped = 0;

    for (const file of files) {
      const key = `${file.name}-${file.size}`;
      if (!acceptedFile(file) || existing.has(key)) {
        skipped += 1;
        continue;
      }
      existing.add(key);
      records.push({
        id: crypto.randomUUID(),
        file,
        studentName: "",
        address: "",
        program: "",
        graduationDate: "",
        fileNameValid: false,
        fileNameError: "",
        skills: [],
        certifications: [],
        needsGraduationDate: false,
        status: "parsing",
      });
    }

    if (skipped) {
      setMessage(`${skipped} file${skipped === 1 ? " was" : "s were"} skipped. Use unique PDF, DOC, or DOCX files under 15 MB.`);
    }
    if (!records.length) return;
    setUploads((current) => [...current, ...records]);
    records.forEach((record) => void parseUpload(record));
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files || []));
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  const saveable = uploads.filter(
    (record) =>
      record.status === "ready"
      && record.fileNameValid
      && Boolean(record.graduationDate),
  );

  async function saveResumes() {
    if (!saveable.length) return;
    setMessage("");
    let account = microsoftAccount;
    let accessToken = "";
    if (!account) {
      const connection = await connectMicrosoft();
      if (!connection) return;
      account = connection.account;
      accessToken = connection.token;
    } else {
      try {
        accessToken = await microsoftAccessToken(account);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Microsoft sign-in failed.");
        return;
      }
    }
    let saved = 0;

    for (const record of saveable) {
      updateUpload(record.id, { status: "saving", error: undefined });
      const body = new FormData();
      body.append("file", record.file);
      body.append("metadata", JSON.stringify({
        studentName: record.studentName,
        address: record.address,
        program: record.program,
        graduationDate: record.graduationDate,
        skills: record.skills,
        certifications: record.certifications,
      }));

      try {
        const response = await fetch("/api/resumes/submit", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "The resume could not be saved.");
        updateUpload(record.id, { status: "saved" });
        saved += 1;
      } catch (error) {
        updateUpload(record.id, {
          status: "error",
          error: error instanceof Error ? error.message : "The resume could not be saved.",
        });
      }
    }

    if (saved) {
      setMessage(saved === 1 ? "Resume Saved" : `${saved} Resumes Saved`);
      await loadLibrary(accessToken);
    }
  }

  const dates = useMemo(
    () => unique(resumes.map((resume) => resume.graduationDate)),
    [resumes],
  );
  const locations = useMemo(
    () => unique(resumes.map((resume) => resume.location)),
    [resumes],
  );
  const filteredResumes = useMemo(() => {
    const name = nameFilter.trim().toLowerCase();
    return resumes.filter((resume) =>
      (!name || resume.studentName.toLowerCase().includes(name))
      && (!programFilter || resume.program === programFilter)
      && (!dateFilter || resume.graduationDate === dateFilter)
      && (!locationFilter || resume.location === locationFilter),
    );
  }, [resumes, nameFilter, programFilter, dateFilter, locationFilter]);

  const hasActiveFilters = Boolean(nameFilter || programFilter || dateFilter || locationFilter);

  return (
    <main className="resume-page">
      <header className="resume-header">
        <a href="/admin/courses"><ArrowLeft size={16} /> Dashboard</a>
        <div>
          <span>Career Services</span>
          <h1>Student Resumes</h1>
        </div>
        <div className="microsoft-session">
          {microsoftAccount ? (
            <>
              <span>{microsoftAccount.name || microsoftAccount.username}</span>
              <button
                type="button"
                onClick={() => void (async () => {
                  await signOutOfMicrosoft();
                  setMicrosoftAccount(null);
                  setResumes([]);
                  setLoadingLibrary(false);
                })()}
              >
                <LogOut size={14} /> Sign out
              </button>
            </>
          ) : (
            <button type="button" disabled={authBusy} onClick={() => void connectMicrosoft()}>
              {authBusy ? <LoaderCircle className="spin" size={14} /> : <LogIn size={14} />}
              Sign in with Microsoft
            </button>
          )}
        </div>
      </header>

      <div className="resume-shell">
        <section className="upload-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">Add resumes</span>
              <h2>Upload and save</h2>
              <p>Drop files below or browse your computer.</p>
            </div>
          </div>

          <div
            className={`simple-dropzone ${dragging ? "dragging" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(event) => event.key === "Enter" && fileInput.current?.click()}
            role="button"
            tabIndex={0}
          >
            <input
              ref={fileInput}
              type="file"
              multiple
              accept=".pdf,.doc,.docx"
              onChange={onFileChange}
              hidden
            />
            <UploadCloud size={27} />
            <div><strong>Drop resumes here</strong><span>or browse files</span></div>
            <small>PDF, DOC, or DOCX · 15 MB maximum</small>
          </div>

          {uploads.length > 0 && (
            <div className="upload-list">
              {uploads.map((record) => (
                <article className={`upload-row ${record.status}`} key={record.id}>
                  <FileText size={20} />
                  <div className="upload-details">
                    <strong>{record.file.name}</strong>
                    {record.status === "parsing" && <span><LoaderCircle className="spin" size={13} /> Checking file…</span>}
                    {record.status === "saving" && <span><LoaderCircle className="spin" size={13} /> Saving…</span>}
                    {record.status === "saved" && <span className="success"><CheckCircle2 size={13} /> Resume Saved</span>}
                    {record.status === "error" && <span className="error">{record.error}</span>}
                    {record.status === "ready" && !record.fileNameValid && (
                      <span className="error">{record.fileNameError}. Example: Automotive Technology - Smith, John - Pittsburgh, PA - May 2026.pdf</span>
                    )}
                    {record.status === "ready" && record.fileNameValid && !record.needsGraduationDate && (
                      <span className="success"><CheckCircle2 size={13} /> Ready · {monthLabel(record.graduationDate)}</span>
                    )}
                    {record.status === "ready" && record.fileNameValid && record.needsGraduationDate && (
                      <label className="date-prompt">
                        Graduation month required
                        <input
                          type="month"
                          value={record.graduationDate}
                          onChange={(event) => updateUpload(record.id, { graduationDate: event.target.value })}
                        />
                      </label>
                    )}
                  </div>
                  {record.status !== "saved" && (
                    <button
                      className="remove-upload"
                      type="button"
                      aria-label={`Remove ${record.file.name}`}
                      onClick={() => setUploads((current) => current.filter((item) => item.id !== record.id))}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}

          <div className="save-row">
            {message && (
              <div className={message.includes("Saved") ? "save-message success" : "save-message"}>
                {message.includes("Saved") && <CheckCircle2 size={17} />}
                {message}
              </div>
            )}
            <button type="button" className="save-button" disabled={!saveable.length} onClick={() => void saveResumes()}>
              Save {saveable.length > 1 ? `${saveable.length} Resumes` : "Resume"}
            </button>
          </div>
        </section>

        <section className="library-card">
          <div className="card-heading library-heading">
            <div>
              <span className="eyebrow">Saved resumes</span>
              <h2>Find a student</h2>
            </div>
            <span className="result-count">{filteredResumes.length} result{filteredResumes.length === 1 ? "" : "s"}</span>
          </div>

          <div className="filter-toolbar">
            <label className="name-search">
              <Search size={16} />
              <input
                value={nameFilter}
                onChange={(event) => setNameFilter(event.target.value)}
                placeholder="First or last name"
              />
            </label>
            <select value={programFilter} onChange={(event) => setProgramFilter(event.target.value)} aria-label="Filter by program">
              <option value="">All programs</option>
              {programs.map((program) => <option key={program}>{program}</option>)}
            </select>
            <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} aria-label="Filter by graduation date">
              <option value="">All graduation dates</option>
              {dates.map((date) => <option key={date} value={date}>{monthLabel(date)}</option>)}
            </select>
            <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} aria-label="Filter by city and state">
              <option value="">All cities and states</option>
              {locations.map((location) => <option key={location}>{location}</option>)}
            </select>
            {hasActiveFilters && (
              <button
                type="button"
                className="clear-filters"
                onClick={() => {
                  setNameFilter("");
                  setProgramFilter("");
                  setDateFilter("");
                  setLocationFilter("");
                }}
              >
                Clear
              </button>
            )}
          </div>

          {!microsoftAccount && !loadingLibrary && !loadError && (
            <div className="library-state">Sign in with Microsoft to view saved resumes.</div>
          )}
          {loadingLibrary && <div className="library-state"><LoaderCircle className="spin" size={20} /> Loading resumes…</div>}
          {!loadingLibrary && loadError && <div className="library-state error">{loadError}</div>}
          {microsoftAccount && !loadingLibrary && !loadError && filteredResumes.length === 0 && (
            <div className="library-state">No resumes match these filters.</div>
          )}
          {microsoftAccount && !loadingLibrary && !loadError && filteredResumes.length > 0 && (
            <div className="resume-table-wrap">
              <table className="resume-table">
                <thead>
                  <tr><th>Student</th><th>Program</th><th>Graduation</th><th>City, State</th><th /></tr>
                </thead>
                <tbody>
                  {filteredResumes.map((resume) => (
                    <tr key={resume.id}>
                      <td><strong>{resume.studentName || resume.name}</strong><span>{resume.name}</span></td>
                      <td>{resume.program || "—"}</td>
                      <td>{monthLabel(resume.graduationDate) || "—"}</td>
                      <td>{resume.location || "—"}</td>
                      <td>
                        {resume.webUrl && (
                          <a href={resume.webUrl} target="_blank" rel="noreferrer" aria-label={`Open ${resume.name}`}>
                            <ExternalLink size={16} />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
