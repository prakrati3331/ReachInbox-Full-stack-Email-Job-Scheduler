interface Props {
  msg: string;
  kind: "ok" | "err";
}

export default function Toast({ msg, kind }: Props) {
  return (
    <div
      className={`rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
        kind === "ok" ? "bg-emerald-600" : "bg-rose-600"
      }`}
    >
      {msg}
    </div>
  );
}
