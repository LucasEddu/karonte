export default function LoadingView() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', color: 'var(--text-primary)' }}>
      <div
        className="spinner"
        style={{
          border: '3px solid var(--border-color)',
          borderTopColor: 'var(--primary-color)',
          borderRadius: '50%',
          width: 40,
          height: 40,
          animation: 'spin 1s linear infinite',
        }}
      />
      <p style={{ marginTop: 15 }}>Conectando ao Karonte...</p>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
