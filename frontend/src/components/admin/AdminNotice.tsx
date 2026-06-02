export type AdminNoticeValue = {
  type: "success" | "error";
  text: string;
};

type AdminNoticeProps = {
  notice: AdminNoticeValue | null;
};

export function AdminNotice({ notice }: AdminNoticeProps) {
  if (!notice) {
    return null;
  }

  const isSuccess = notice.type === "success";

  return (
    <div
      role="status"
      className={`rounded-lg border px-4 py-3 text-sm ${
        isSuccess
          ? "border-green-500/40 bg-green-500/10 text-green-300"
          : "border-red-500/40 bg-red-500/10 text-red-300"
      }`}
    >
      {notice.text}
    </div>
  );
}
