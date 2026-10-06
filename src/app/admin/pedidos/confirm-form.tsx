"use client";

/**
 * Formulário de server action que pergunta antes de enviar. Para as ações de
 * pedido que agem na hora e mexem em estoque ou dinheiro (cancelar, confirmar
 * pagamento, marcar estornado): o detalhe do pedido é também a folha de tela
 * cheia do celular, e um toque errado não pode virar venda cancelada.
 */
export function ConfirmForm({
  action,
  message,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  message: string;
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
