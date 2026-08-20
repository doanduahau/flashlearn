"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function AuditDetailDrawer({ entry }: Readonly<{ entry: Record<string, unknown> }>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setOpen(true)}>
        Xem
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Chi tiết nhật ký</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 text-sm">
            <Row label="Thời điểm">
              {new Date(entry.created_at as string).toLocaleString("vi-VN")}
            </Row>
            <Row label="Actor">
              <span className="font-mono text-xs">{(entry.actor as string) ?? "—"}</span>
            </Row>
            <Row label="Hành động">
              <span className="font-mono text-xs">{entry.action as string}</span>
            </Row>
            <Row label="Đối tượng">
              {entry.target_type as string}:{entry.target_id as string}
            </Row>
            <Row label="Lý do">{(entry.reason as string) || "—"}</Row>
            <Row label="Correlation ID">
              <span className="font-mono text-xs">{(entry.correlation_id as string) ?? "—"}</span>
            </Row>
            {entry.before_summary ? (
              <Row label="Trước khi thay đổi">
                <pre className="max-h-40 overflow-auto rounded-lg bg-surface-subtle p-2 text-xs">
                  {JSON.stringify(entry.before_summary, null, 2)}
                </pre>
              </Row>
            ) : null}
            {entry.after_summary ? (
              <Row label="Sau khi thay đổi">
                <pre className="max-h-40 overflow-auto rounded-lg bg-surface-subtle p-2 text-xs">
                  {JSON.stringify(entry.after_summary, null, 2)}
                </pre>
              </Row>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div>
      <dt className="text-xs text-text-secondary">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
