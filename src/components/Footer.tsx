export default function Footer() {
  return (
    <footer className="mt-auto border-t border-neutral-800">
      <div className="mx-auto max-w-5xl px-6 py-6 text-sm text-neutral-500">
        &copy; {new Date().getFullYear()} 5 Minute Games
      </div>
    </footer>
  );
}
