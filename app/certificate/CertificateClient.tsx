"use client";

import { useEffect, useState } from "react";

type StudentRecord = {
  id: number;
  FirstName: string;
  LastName: string;
  CourseName: string;
  CertificateId?: string;
  CompletedAt?: string;
};

export default function CertificateClient() {

  // 🖨️ PRINT ONLY THE CERTIFICATE
  const printCertificate = () => {
    const cert = document.getElementById("certificate");
    if (!cert) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Certificate</title>
          <style>
            body {
              margin: 0;
              font-family: Georgia, "Times New Roman", serif;
              background: white;
            }

            .page {
              width: 1100px;
              height: 700px;
              margin: auto;
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .frame {
              width: 100%;
              height: 100%;
              border: 10px solid #1e3a8a;
              padding: 60px;
              box-sizing: border-box;
              text-align: center;
              position: relative;
            }

            h1 { font-size: 48px; margin-bottom: 20px; }
            h2 { font-size: 36px; margin: 20px 0; }
            h3 { font-size: 28px; margin: 20px 0; }
            p  { font-size: 20px; margin: 12px 0; }

            .signatures {
              display: flex;
              justify-content: space-between;
              margin-top: 80px;
            }

            .sig-line {
              border-top: 2px solid black;
              width: 260px;
              margin: auto;
            }

            .cert-id {
              position: absolute;
              bottom: 20px;
              right: 40px;
              font-size: 12px;
            }

            @media print {
              body { margin: 0; }
            }
          </style>
        </head>

        <body>
          <div class="page">
            <div class="frame">
              ${cert.innerHTML}
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const [record, setRecord] = useState<StudentRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") ?? "";

    if (!code) return;

    fetch(`/api/course?code=${encodeURIComponent(code)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Certificate unavailable.");
        setRecord(data as StudentRecord);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Certificate unavailable."));
  }, []);

  if (!record) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 text-center">
        {error || "Loading certificate..."}
      </main>
    );
  }

  const issuedOn = new Date(record.CompletedAt || Date.now()).toLocaleDateString();

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="space-y-6 text-center">

        {/* 🏆 CERTIFICATE CONTENT */}
        <div
          id="certificate"
          className="bg-white w-[1100px] h-[700px] mx-auto relative flex items-center justify-center"
        >
          {/* BORDER */}
          <div className="absolute inset-6 border-8 border-blue-900 rounded-lg"></div>

          <div className="relative text-center px-20">

            <div className="mb-6 text-blue-900 font-bold text-xl">
              New Castle School of Trades
            </div>

            <h1 className="text-5xl font-serif font-bold text-blue-900 mb-6">
              Certificate of Completion
            </h1>

            <p className="text-xl mb-6">
              This certifies that
            </p>

            <h2 className="text-4xl font-semibold border-b-2 border-slate-400 inline-block px-10 pb-2 mb-6">
              {record.FirstName} {record.LastName}
            </h2>

            <p className="text-xl mb-6">
              has successfully completed the training course
            </p>

            <h3 className="text-3xl font-bold text-blue-900 mb-8">
              {record.CourseName}
            </h3>

            <p className="mb-12">
              Issued on {issuedOn}
            </p>

            <div className="flex justify-between mt-16 text-sm">

              <div className="text-center">
                <div className="border-t w-64 mx-auto mb-2"></div>
                Instructor Signature
              </div>

              <div className="text-center">
                <div className="border-t w-64 mx-auto mb-2"></div>
                Authorized Signature
              </div>

            </div>

            <div className="absolute bottom-4 right-8 text-xs text-slate-600">
              Certificate ID: {record.CertificateId || `CERT-${record.id}`}
            </div>

          </div>
        </div>

        {/* 🖨️ BUTTONS */}
        <div className="flex justify-center gap-4">
          <button
            onClick={printCertificate}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl"
          >
            Print / Save as PDF
          </button>

          <button
            onClick={() => (window.location.href = "/")}
            className="px-6 py-3 bg-slate-600 text-white rounded-xl"
          >
            Exit
          </button>
        </div>

      </div>
    </main>
  );
}
