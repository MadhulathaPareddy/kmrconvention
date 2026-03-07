'use client';

export function DeleteExpenditureButton({ id }: { id: string }) {
  async function handleDelete() {
    if (!confirm('Delete this expenditure?')) return;
    await fetch(`/api/expenditures/${id}`, { method: 'DELETE' });
    window.location.reload();
  }
  return (
    <button
      type="button"
      onClick={handleDelete}
      className="text-sm text-red-600 hover:text-red-700"
    >
      Delete
    </button>
  );
}
