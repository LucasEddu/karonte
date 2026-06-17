import { formatMoney } from '../utils/money';

export default function ChatAssistant({
  chatOpen,
  setChatOpen,
  unreadCount,
  chatMessages,
  chatInput,
  setChatInput,
  pendingActions,
  isRecording,
  fabPosition,
  isDraggingFab,
  hasSpeechSupport,
  fabButtonRef,
  chatWindowRef,
  chatWindowStyle,
  handleChatSubmit,
  handleChatConfirm,
  handleChatCancel,
  handleVoiceToggle,
  handleFabMouseDown,
  chatSuggestionClick,
}) {
  const lastMsg = chatMessages[chatMessages.length - 1];
  const showActionCard = (msg) =>
    msg.sender === 'bot'
    && pendingActions.length > 0
    && lastMsg?.id === msg.id
    && (msg.text.includes('Deseja registrar')
      || msg.text.includes('Vamos para o próximo')
      || msg.text.includes('Entendi a correção'));

  return (
    <>
      {!chatOpen && (
        <button
          type="button"
          className={`chat-fab ${unreadCount > 0 ? 'has-unread' : ''}`}
          onClick={() => { if (!isDraggingFab) setChatOpen(true); }}
          onMouseDown={handleFabMouseDown}
          ref={fabButtonRef}
          style={{ left: `${fabPosition.x}px`, top: `${fabPosition.y}px` }}
        >
          <img src="/karonte-favicon-light.svg" alt="Karonte" className="fab-icon-img" />
          {unreadCount > 0 ? <span className="fab-badge">{unreadCount}</span> : null}
        </button>
      )}

      <aside
        className={`chatbot-float-window ${chatOpen ? 'open' : ''}`}
        ref={chatWindowRef}
        style={chatWindowStyle}
      >
        <div className="chat-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="bot-avatar">
              <img src="/karonte-favicon-light.svg" alt="K" />
            </div>
            <div className="bot-info">
              <span className="bot-name">Karonte</span>
              <span className="bot-status">Online</span>
            </div>
          </div>
          <button type="button" className="chat-close-btn" onClick={() => setChatOpen(false)}>×</button>
        </div>

        <div className="chat-messages">
          {chatMessages.map((msg) => (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className={`chat-bubble ${msg.sender}`}>
                {msg.text}
              </div>

              {showActionCard(msg) ? (
                <div className="chat-action-card">
                  <div className="action-title">Resumo Extraído</div>
                  <div className="action-detail">
                    <span>Tipo:</span>
                    <span
                      className="action-val"
                      style={{ color: pendingActions[0].type === 'expense' ? 'var(--danger-color)' : 'var(--success-color)' }}
                    >
                      {pendingActions[0].type === 'income' ? 'Receita' : 'Despesa'}
                    </span>
                  </div>
                  <div className="action-detail">
                    <span>Valor:</span>
                    <span className="action-val">R$ {formatMoney(pendingActions[0].amount)}</span>
                  </div>
                  <div className="action-detail">
                    <span>Info:</span>
                    <span className="action-val">{pendingActions[0].description}</span>
                  </div>
                  <div className="action-detail">
                    <span>Categoria:</span>
                    <span className="action-val">{pendingActions[0].category}</span>
                  </div>
                  <div className="action-buttons">
                    <button type="button" className="btn-confirm" onClick={handleChatConfirm}>Confirmar</button>
                    <button type="button" className="btn-cancel" onClick={handleChatCancel}>Cancelar</button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="chat-input-area">
          <div className="chat-suggestions">
            <button type="button" className="suggestion-chip" onClick={() => chatSuggestionClick('50 ifood')}>🍟 50 ifood</button>
            <button type="button" className="suggestion-chip" onClick={() => chatSuggestionClick('90 uber')}>🚗 90 uber</button>
            <button type="button" className="suggestion-chip" onClick={() => chatSuggestionClick('Qual meu saldo?')}>📊 Qual meu saldo?</button>
          </div>
          <form onSubmit={handleChatSubmit} className="chat-form">
            <input
              type="text"
              className="chat-input"
              placeholder={pendingActions.length > 0 ? 'Sim ou Não...' : 'Ex: 120 da academia'}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <button
              type="button"
              className={`chat-voice-btn ${isRecording ? 'recording' : ''}`}
              onClick={handleVoiceToggle}
              title={hasSpeechSupport ? 'Comando de Voz' : 'Seu navegador não suporta reconhecimento de voz da Web API.'}
              disabled={!hasSpeechSupport}
              style={!hasSpeechSupport ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              🎙️
            </button>
            <button type="submit" className="chat-send-btn" disabled={!chatInput.trim()}>
              ↑
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
