"use client";

import { useActionState, useEffect, useState } from "react";
import { saveHomeSectionAction, type ActionResult } from "./actions";
import { ImageField } from "./image-field";
import { useToast } from "@/components/toast";
import { SubmitButton } from "@/components/submit-button";
import type {
  BannerSlide,
  HomeSection,
  MosaicCard,
  VitrineSource,
} from "@/lib/home-sections";
import type { StoreCategory } from "@/lib/categories";

const field =
  "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground";
const label = "block text-sm font-medium";

const emptySlide: BannerSlide = {
  imageDesktop: null,
  imageMobile: null,
  title: null,
  subtitle: null,
  buttonLabel: null,
  buttonHref: null,
  align: "left",
  theme: "light",
};

/** Id só do cliente, para a `key` do React não ser o índice (remover um item
 *  no meio remontaria os vizinhos e embaralharia as prévias de imagem). */
let rowSeq = 0;
const nextRowId = () => `row-${rowSeq++}`;

export function HomeSectionEditor({
  section,
  categories,
}: {
  section: HomeSection;
  categories: StoreCategory[];
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    saveHomeSectionAction,
    null,
  );
  const { showToast } = useToast();
  useEffect(() => {
    if (state?.ok) showToast("Bloco salvo");
    else if (state?.error) showToast(state.error, "error");
  }, [state, showToast]);

  // Estado por tipo (só um é usado, conforme section.kind).
  const [text, setText] = useState(section.data.text ?? "");
  const [href, setHref] = useState(section.data.href ?? "");
  const [title, setTitle] = useState(section.data.title ?? "");
  const [slides, setSlides] = useState<(BannerSlide & { _id: string })[]>(() =>
    (section.data.slides?.length ? section.data.slides : [emptySlide]).map(
      (s) => ({ ...s, _id: nextRowId() }),
    ),
  );
  const [cards, setCards] = useState<(MosaicCard & { _id: string })[]>(() =>
    (section.data.cards?.length
      ? section.data.cards
      : [{ image: null, label: "", href: "/produtos" }]
    ).map((c) => ({ ...c, _id: nextRowId() })),
  );
  // Uploads em andamento: trava o "Salvar" (senão a foto some do que foi salvo).
  const [uploading, setUploading] = useState(0);
  const trackUpload = (busy: boolean) =>
    setUploading((n) => Math.max(0, n + (busy ? 1 : -1)));
  const [source, setSource] = useState<VitrineSource>(
    section.data.source ?? "destaques",
  );
  const [categoryId, setCategoryId] = useState(section.data.categoryId ?? "");
  const [limit, setLimit] = useState(String(section.data.limit ?? 8));

  function setSlide(i: number, patch: Partial<BannerSlide>) {
    setSlides((ss) => ss.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  }
  function setCard(i: number, patch: Partial<MosaicCard>) {
    setCards((cs) => cs.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  }

  // Vitrine de categoria sem categoria mostraria o catálogo inteiro na home.
  const missingCategory =
    section.kind === "vitrine" && source === "categoria" && !categoryId;

  const payload = JSON.stringify(
    section.kind === "aviso"
      ? { text, href }
      : section.kind === "banner"
        ? { slides: slides.map(({ _id, ...s }) => s) } // eslint-disable-line @typescript-eslint/no-unused-vars
        : section.kind === "mosaico"
          ? { title, cards: cards.map(({ _id, ...c }) => c) } // eslint-disable-line @typescript-eslint/no-unused-vars
          : { title, source, categoryId, limit: Number(limit) || 8 },
  );

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="sectionId" value={section.id} />
      <input type="hidden" name="payload" value={payload} />

      <div className="space-y-1.5">
        <label className={label} htmlFor="section-name">
          Nome do bloco
        </label>
        <input
          id="section-name"
          name="name"
          defaultValue={section.name}
          placeholder="Ex.: Banner Dia dos Pais"
          className={`${field} max-w-sm`}
        />
        <p className="text-xs text-muted">
          Só para você identificar aqui no painel — não aparece na loja.
        </p>
      </div>

      {section.kind === "aviso" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className={label} htmlFor="aviso-text">
              Texto da faixa
            </label>
            <input
              id="aviso-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="PARCELE EM 12X SEM JUROS"
              className={field}
            />
          </div>
          <div className="space-y-1.5">
            <label className={label} htmlFor="aviso-href">
              Link (opcional)
            </label>
            <input
              id="aviso-href"
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="/produtos?promo=1"
              className={field}
            />
          </div>
        </div>
      )}

      {section.kind === "banner" && (
        <div className="space-y-6">
          {slides.map((s, i) => (
            <div
              key={s._id}
              className="space-y-4 rounded-lg border border-border p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Banner {i + 1}
                </p>
                {slides.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setSlides((ss) => ss.filter((_, k) => k !== i))
                    }
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    remover
                  </button>
                )}
              </div>

              <ImageField
                label="Imagem (desktop)"
                hint="Horizontal, ideal 1920×1080. É a que aparece no computador."
                value={s.imageDesktop}
                onChange={(v) => setSlide(i, { imageDesktop: v })}
                onBusyChange={trackUpload}
              />
              <ImageField
                label="Imagem (celular) — opcional"
                hint="Vertical, ideal 1080×1350. Sem ela, usa a de desktop recortada."
                value={s.imageMobile}
                onChange={(v) => setSlide(i, { imageMobile: v })}
                onBusyChange={trackUpload}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className={label}>Chapéu (linha pequena)</label>
                  <input
                    value={s.subtitle ?? ""}
                    onChange={(e) => setSlide(i, { subtitle: e.target.value })}
                    placeholder="ESPECIAL DIA DOS PAIS"
                    className={field}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={label}>Título</label>
                  <input
                    value={s.title ?? ""}
                    onChange={(e) => setSlide(i, { title: e.target.value })}
                    placeholder="Presentes que unem sofisticação"
                    className={field}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={label}>Texto do botão</label>
                  <input
                    value={s.buttonLabel ?? ""}
                    onChange={(e) =>
                      setSlide(i, { buttonLabel: e.target.value })
                    }
                    placeholder="APROVEITAR AGORA"
                    className={field}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={label}>Link do botão</label>
                  <input
                    value={s.buttonHref ?? ""}
                    onChange={(e) =>
                      setSlide(i, { buttonHref: e.target.value })
                    }
                    placeholder="/produtos?promo=1"
                    className={field}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={label}>Posição do texto</label>
                  <select
                    value={s.align}
                    onChange={(e) =>
                      setSlide(i, {
                        align: e.target.value as BannerSlide["align"],
                      })
                    }
                    className={field}
                  >
                    <option value="left">Esquerda</option>
                    <option value="center">Centro</option>
                    <option value="right">Direita</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={label}>Cor do texto</label>
                  <select
                    value={s.theme}
                    onChange={(e) =>
                      setSlide(i, {
                        theme: e.target.value as BannerSlide["theme"],
                      })
                    }
                    className={field}
                  >
                    <option value="light">Claro (foto escura)</option>
                    <option value="dark">Escuro (foto clara)</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setSlides((ss) => [...ss, { ...emptySlide, _id: nextRowId() }])
            }
            className="rounded-full border border-dashed border-border px-4 py-2 text-sm hover:border-foreground"
          >
            + Adicionar banner ao carrossel
          </button>
        </div>
      )}

      {section.kind === "mosaico" && (
        <div className="space-y-6">
          <div className="space-y-1.5">
            <label className={label}>Título da seção (opcional)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Compre por categoria"
              className={field}
            />
          </div>

          {cards.map((c, i) => (
            <div
              key={c._id}
              className="space-y-4 rounded-lg border border-border p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Cartão {i + 1}
                </p>
                {cards.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setCards((cs) => cs.filter((_, k) => k !== i))
                    }
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    remover
                  </button>
                )}
              </div>
              <ImageField
                label="Imagem"
                hint="Vertical, ideal 900×1200."
                value={c.image}
                onChange={(v) => setCard(i, { image: v })}
                onBusyChange={trackUpload}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className={label}>Nome</label>
                  <input
                    value={c.label}
                    onChange={(e) => setCard(i, { label: e.target.value })}
                    placeholder="Camisas"
                    className={field}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={label}>Link</label>
                  <input
                    value={c.href}
                    onChange={(e) => setCard(i, { href: e.target.value })}
                    placeholder="/produtos?categorias=camisas"
                    className={field}
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setCards((cs) => [
                ...cs,
                { image: null, label: "", href: "/produtos", _id: nextRowId() },
              ])
            }
            className="rounded-full border border-dashed border-border px-4 py-2 text-sm hover:border-foreground"
          >
            + Adicionar cartão
          </button>
        </div>
      )}

      {section.kind === "vitrine" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className={label}>Título da seção</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Novidades"
              className={field}
            />
          </div>
          <div className="space-y-1.5">
            <label className={label}>O que mostrar</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as VitrineSource)}
              className={field}
            >
              <option value="destaques">Produtos em destaque</option>
              <option value="promo">Produtos em promoção</option>
              <option value="categoria">Uma categoria</option>
            </select>
          </div>
          {source === "categoria" && (
            <div className="space-y-1.5">
              <label className={label}>Categoria</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={field}
              >
                <option value="">Selecione…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <label className={label}>Quantos produtos</label>
            <input
              type="number"
              min="1"
              max="12"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className={field}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <SubmitButton
          disabled={uploading > 0 || missingCategory}
          pendingText="Salvando…"
          className="h-11 rounded-full bg-foreground px-8 text-sm font-medium text-background hover:opacity-90"
        >
          Salvar bloco
        </SubmitButton>
        {uploading > 0 && (
          <span className="text-sm text-muted">
            Enviando imagem… aguarde para salvar.
          </span>
        )}
        {missingCategory && (
          <span className="text-sm text-muted">Escolha a categoria.</span>
        )}
        {state?.error && (
          <span className="text-sm text-red-600">{state.error}</span>
        )}
      </div>
    </form>
  );
}
