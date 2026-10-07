"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { AnnouncementBar } from "@/components/announcement-bar";
import { CategoryStrip } from "@/components/category-strip";
import { EtiquetasDaFoto, HomeHero } from "@/components/home-hero";
import { ProductPlaceholder } from "@/components/product-placeholder";
import { SiteHeader, type NavCategory } from "@/components/site-header";
import { useToast } from "@/components/toast";
import type { Department } from "@/lib/departments";
import {
  aplicaAtalhos,
  faixaVisivel,
  LIMITES,
  MAX_AVISOS,
  MAX_ETIQUETAS,
  posicionaRotulo,
  PROPORCAO_AREA,
  ratioDoFormato,
  textoAvisoFrete,
  type AvisoConfig,
  type Formato,
  type HomeConfig,
  type ProductPhoto,
} from "@/lib/home-config";
import type { CategoryCover, CategoryCoversByDepartment } from "@/lib/products";
import { PageHeader, Panel, primaryButton, secondaryButton } from "../admin-ui";
import {
  discardHomeDraftAction,
  publishHomeAction,
  saveHomeDraftAction,
  type HomeConfigResult,
} from "../home-config-actions";
import { PhonePreview } from "./phone-preview";
import { PhotoPicker } from "./photo-picker";

export type HomeEditorProps = {
  status: "pronta" | "sem-migracao" | "sem-chave" | "erro";
  /** O que o editor abre (rascunho salvo, ou o publicado). */
  inicial: HomeConfig;
  publicado: HomeConfig;
  photos: ProductPhoto[];
  /** Capas AUTOMÁTICAS por departamento (antes da escolha do dono). */
  covers: CategoryCoversByDepartment;
  freteAtivo: boolean;
  temFeminino: boolean;
  menu: Record<Department, NavCategory[]>;
  whatsappUrl: string;
};

const igual = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

const campo =
  "w-full rounded-xs border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground";
const linkAcao =
  "text-sm underline underline-offset-4 hover:text-foreground disabled:opacity-40 disabled:no-underline";

/**
 * Editor da página inicial: destaque principal, faixa de avisos e atalhos de
 * categoria, com a prévia no celular ao lado.
 *
 * Tudo acontece no navegador até o dono apertar um botão: a prévia é
 * alimentada pelo estado do editor (sem salvar, sem ida ao servidor). "Salvar
 * rascunho" guarda sem mexer na loja; "Publicar" leva para a loja;
 * "Descartar" volta ao que está no ar.
 */
export function HomeEditor(props: HomeEditorProps) {
  const { status, photos, covers, freteAtivo, temFeminino } = props;
  const { showToast } = useToast();
  const [cfg, setCfg] = useState<HomeConfig>(props.inicial);
  const [salvo, setSalvo] = useState<HomeConfig>(props.inicial);
  const [pub, setPub] = useState<HomeConfig>(props.publicado);
  const [sel, setSel] = useState<number | null>(null);
  /** Qual formato do destaque se está editando (etiquetas e enquadramento). */
  const [formato, setFormato] = useState<Formato>("cel");
  /** Qual formato a prévia mostra. */
  const [previa, setPrevia] = useState<Formato>("cel");
  const [picker, setPicker] = useState<
    | null
    | { tipo: "hero" }
    | { tipo: "heroPc" }
    | { tipo: "atalho"; id: string; nome: string }
  >(null);
  const [pending, start] = useTransition();

  const podeSalvar = status === "pronta";
  const alterado = !igual(cfg, salvo);
  const rascunhoForaDoAr = !igual(salvo, pub);

  // Sair da tela com alteração não salva perde o trabalho: o navegador avisa.
  useEffect(() => {
    if (!alterado) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [alterado]);

  /* ---------------- ações ---------------- */

  function executar(
    fn: () => Promise<HomeConfigResult>,
    sucesso: string,
    depois: (c: HomeConfig) => void,
  ) {
    start(async () => {
      const r = await fn();
      if (!r.ok || !r.config) {
        showToast(r.error ?? "Não foi possível concluir.", "error");
        return;
      }
      depois(r.config);
      showToast(sucesso);
    });
  }

  const salvar = () =>
    executar(
      () => saveHomeDraftAction(cfg),
      "Rascunho salvo",
      (c) => {
        setCfg(c);
        setSalvo(c);
      },
    );

  const publicar = () =>
    executar(
      () => publishHomeAction(cfg),
      "Publicado na loja",
      (c) => {
        setCfg(c);
        setSalvo(c);
        setPub(c);
      },
    );

  function descartar() {
    if (!window.confirm("Descartar as alterações e voltar ao que está no ar?"))
      return;
    setSel(null);
    // Sem rascunho salvo, basta voltar a tela; com rascunho, apaga no banco.
    if (!rascunhoForaDoAr || !podeSalvar) {
      setCfg(pub);
      setSalvo(pub);
      return;
    }
    executar(
      () => discardHomeDraftAction(),
      "Rascunho descartado",
      (c) => {
        setCfg(c);
        setSalvo(c);
        setPub(c);
      },
    );
  }

  /* ---------------- hero ---------------- */

  const hero = cfg.hero;
  const setHero = (patch: Partial<HomeConfig["hero"]>) =>
    setCfg((c) => ({ ...c, hero: { ...c.hero, ...patch } }));

  // A foto e o enquadramento do formato em edição.
  const ratioAtual = ratioDoFormato(hero, formato);
  const focoAtual = formato === "cel" ? hero.focoCel : hero.focoPc;
  const fotoAtual =
    formato === "pc" && hero.fotoPc ? hero.fotoPc.image : hero.image;
  const faixa = faixaVisivel(ratioAtual, PROPORCAO_AREA[formato], focoAtual);
  // A área corta dos lados (celular, foto vertical) ou em cima/embaixo?
  const cortaLados = PROPORCAO_AREA[formato] < ratioAtual;

  function setFoco(patch: Partial<HomeConfig["hero"]["focoCel"]>) {
    setCfg((c) =>
      formato === "cel"
        ? {
            ...c,
            hero: { ...c.hero, focoCel: { ...c.hero.focoCel, ...patch } },
          }
        : { ...c, hero: { ...c.hero, focoPc: { ...c.hero.focoPc, ...patch } } },
    );
  }

  /** Ao carregar, a foto informa a proporção real — é o que põe as etiquetas
   * no lugar certo na loja. Só grava se mudou (senão marcaria "alterado"). */
  function mediuFoto(qual: "cel" | "pc", w: number, h: number) {
    if (!w || !h) return;
    const r = Math.round((w / h) * 10000) / 10000;
    setCfg((c) => {
      if (qual === "pc") {
        if (!c.hero.fotoPc || Math.abs(c.hero.fotoPc.ratio - r) < 0.005)
          return c;
        return {
          ...c,
          hero: { ...c.hero, fotoPc: { ...c.hero.fotoPc, ratio: r } },
        };
      }
      if (Math.abs(c.hero.ratio - r) < 0.005) return c;
      return { ...c, hero: { ...c.hero, ratio: r } };
    });
  }

  function moverEtiqueta(i: number, x: number, y: number) {
    setCfg((c) => {
      const tags = c.hero.tags.slice();
      const t = tags[i];
      if (!t) return c;
      const lado = t[formato]?.lado ?? (x < 50 ? "e" : "d");
      tags[i] = { ...t, [formato]: posicionaRotulo(x, y, lado, formato) };
      return { ...c, hero: { ...c.hero, tags } };
    });
  }

  function trocarLado(i: number, lado: "e" | "d") {
    setCfg((c) => {
      const tags = c.hero.tags.slice();
      const t = tags[i];
      const p = t?.[formato];
      if (!t || !p || p.lado === lado) return c;
      tags[i] = { ...t, [formato]: posicionaRotulo(p.x, p.y, lado, formato) };
      return { ...c, hero: { ...c.hero, tags } };
    });
  }

  /** Mostra/esconde a etiqueta neste formato. Ao mostrar, nasce no meio da
   * parte da foto que aparece. */
  function alternarNoFormato(i: number) {
    setCfg((c) => {
      const tags = c.hero.tags.slice();
      const t = tags[i];
      if (!t) return c;
      const cx = (faixa.x0 + faixa.x1) / 2;
      const cy = faixa.y0 + (faixa.y1 - faixa.y0) * 0.35;
      tags[i] = {
        ...t,
        [formato]: t[formato] ? null : posicionaRotulo(cx, cy, "d", formato),
      };
      return { ...c, hero: { ...c.hero, tags } };
    });
    setSel(i);
  }

  function renomearEtiqueta(i: number, label: string) {
    setCfg((c) => {
      const tags = c.hero.tags.slice();
      if (!tags[i]) return c;
      tags[i] = { ...tags[i], label: label.slice(0, LIMITES.etiqueta) };
      return { ...c, hero: { ...c.hero, tags } };
    });
  }

  function adicionarEtiqueta() {
    if (hero.tags.length >= MAX_ETIQUETAS) return;
    const nova = {
      label: "Nova etiqueta",
      cel: posicionaRotulo(50, 40, "d", "cel"),
      pc: posicionaRotulo(50, 40, "d", "pc"),
    };
    setHero({ tags: [...hero.tags, nova] });
    setSel(hero.tags.length);
  }

  function removerEtiqueta(i: number) {
    setHero({ tags: hero.tags.filter((_, j) => j !== i) });
    setSel(null);
  }

  function pontoDoEvento(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    };
  }

  // Peças que podem ir no "Na foto": as que têm endereço, uma vez cada.
  const pecas = useMemo(() => {
    const m = new Map<
      string,
      { slug: string; name: string; active: boolean }
    >();
    for (const p of photos)
      if (p.slug && !m.has(p.slug))
        m.set(p.slug, { slug: p.slug, name: p.productName, active: p.active });
    return [...m.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    );
  }, [photos]);

  /* ---------------- avisos ---------------- */

  const setAvisos = (fn: (a: AvisoConfig[]) => AvisoConfig[]) =>
    setCfg((c) => ({ ...c, avisos: fn(c.avisos) }));

  function moverAviso(i: number, d: -1 | 1) {
    setAvisos((a) => {
      const j = i + d;
      if (j < 0 || j >= a.length) return a;
      const n = a.slice();
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }

  /* ---------------- atalhos ---------------- */

  // Todas as categorias com peça ativa (dos dois departamentos, sem repetir),
  // na ordem que a loja vai mostrar — as ocultas ficam no lugar, apagadas.
  const categorias = useMemo(() => {
    const m = new Map<string, CategoryCover>();
    for (const d of ["masculino", "feminino"] as const)
      for (const c of covers[d]) if (!m.has(c.id)) m.set(c.id, c);
    const auto = [...m.values()];
    const pos = new Map(cfg.atalhos.ordem.map((id, i) => [id, i]));
    return auto
      .map((c, i) => ({ c, i }))
      .sort((a, b) => {
        const pa = pos.get(a.c.id);
        const pb = pos.get(b.c.id);
        if (pa != null && pb != null) return pa - pb;
        if (pa != null) return -1;
        if (pb != null) return 1;
        return a.i - b.i;
      })
      .map(({ c }) => c);
  }, [covers, cfg.atalhos.ordem]);

  const setAtalhos = (patch: Partial<HomeConfig["atalhos"]>) =>
    setCfg((c) => ({ ...c, atalhos: { ...c.atalhos, ...patch } }));

  function moverAtalho(i: number, d: -1 | 1) {
    const ids = categorias.map((c) => c.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setAtalhos({ ordem: ids });
  }

  function alternarAtalho(id: string) {
    const ocultas = cfg.atalhos.ocultas.includes(id)
      ? cfg.atalhos.ocultas.filter((x) => x !== id)
      : [...cfg.atalhos.ocultas, id];
    setAtalhos({ ocultas });
  }

  function fotoDoAtalho(id: string, url: string | null) {
    const fotos = { ...cfg.atalhos.fotos };
    if (url) fotos[id] = url;
    else delete fotos[id];
    setAtalhos({ fotos });
  }

  /* ---------------- tela ---------------- */

  const statusTexto = alterado
    ? "Alterações não salvas"
    : rascunhoForaDoAr
      ? "Rascunho salvo, ainda não publicado"
      : "Igual ao que está no ar";

  // Número de cada atalho VISÍVEL (as ocultas não contam), como na loja.
  const numeros = new Map<string, number>();
  for (const c of categorias)
    if (!cfg.atalhos.ocultas.includes(c.id))
      numeros.set(c.id, numeros.size + 1);

  return (
    <div>
      <PageHeader
        title="Página inicial"
        description="O que aparece primeiro na loja. As mudanças só vão ao ar quando você publicar."
      >
        <span className="mr-1 text-sm text-muted" aria-live="polite">
          {pending ? "Salvando…" : statusTexto}
        </span>
        <button
          type="button"
          onClick={descartar}
          disabled={pending || (!alterado && !rascunhoForaDoAr)}
          className={`${secondaryButton} disabled:opacity-50`}
        >
          Descartar
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={pending || !podeSalvar || !alterado}
          className={`${secondaryButton} disabled:opacity-50`}
        >
          Salvar rascunho
        </button>
        <button
          type="button"
          onClick={publicar}
          disabled={pending || !podeSalvar || (!alterado && !rascunhoForaDoAr)}
          className={`${primaryButton} disabled:opacity-50`}
        >
          Publicar
        </button>
      </PageHeader>

      {status !== "pronta" && (
        <div className="mb-6 rounded-sm border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
          {status === "sem-migracao" ? (
            <>
              <p className="font-semibold">
                Aplique a migração 0023 para poder salvar.
              </p>
              <p className="mt-1 text-muted">
                A tabela da página inicial ainda não existe no banco. Dá para
                montar e conferir na prévia, mas Salvar e Publicar ficam
                travados — e a loja segue com a página de sempre.
              </p>
            </>
          ) : status === "sem-chave" ? (
            <p>
              Falta a <code>SUPABASE_SERVICE_ROLE_KEY</code> neste servidor: a
              prévia funciona, mas não dá para salvar daqui.
            </p>
          ) : (
            <p>
              Não foi possível ler a configuração salva. O editor abriu com os
              valores de fábrica — confira antes de publicar.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="min-w-0 space-y-5">
          <nav
            aria-label="Partes da página"
            className="inline-flex flex-wrap rounded-xs border border-border bg-background text-sm"
          >
            {[
              ["#destaque", "Destaque principal"],
              ["#avisos", "Faixa de avisos"],
              ["#atalhos", "Atalhos de categoria"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="px-4 py-2 font-medium text-muted hover:bg-surface hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* ---------------- Destaque principal ---------------- */}
          <Panel className="scroll-mt-6 p-5 lg:p-6">
            <section id="destaque" className="scroll-mt-6">
              <h2 className="font-display text-lg font-bold">
                Destaque principal
              </h2>
              <p className="mt-0.5 text-sm text-muted">
                A primeira imagem da loja, em tela inteira. Celular e computador
                têm enquadramento próprio; as etiquetas aparecem só no celular —
                toque numa etiqueta da lista e clique (ou arraste) na foto para
                colocá-la.
              </p>

              {/* Formato em edição */}
              <div
                role="tablist"
                aria-label="Formato"
                className="mt-4 inline-flex overflow-hidden rounded-xs border border-border text-sm"
              >
                {(
                  [
                    ["cel", "Celular"],
                    ["pc", "Computador"],
                  ] as const
                ).map(([f, rotulo]) => (
                  <button
                    key={f}
                    type="button"
                    role="tab"
                    aria-selected={formato === f}
                    onClick={() => {
                      setFormato(f);
                      setPrevia(f);
                    }}
                    className={`px-4 py-2 font-medium ${
                      formato === f
                        ? "bg-foreground text-background"
                        : "hover:bg-surface"
                    }`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
                <div>
                  {/* A foto INTEIRA, na proporção dela. O que fica fora da
                      faixa clara pode não aparecer na tela (depende do
                      aparelho); no celular, a faixa listrada é onde o título
                      fica por cima. */}
                  <div
                    onPointerDown={(e) => {
                      if (
                        formato !== "cel" ||
                        sel == null ||
                        !hero.tags[sel]?.cel
                      )
                        return;
                      e.currentTarget.setPointerCapture(e.pointerId);
                      const p = pontoDoEvento(e);
                      moverEtiqueta(sel, p.x, p.y);
                    }}
                    onPointerMove={(e) => {
                      if (sel == null || e.buttons !== 1) return;
                      if (formato !== "cel" || !hero.tags[sel]?.cel) return;
                      const p = pontoDoEvento(e);
                      moverEtiqueta(sel, p.x, p.y);
                    }}
                    className={`relative touch-none select-none overflow-hidden bg-surface ${
                      formato === "cel" && sel != null && hero.tags[sel]?.cel
                        ? "cursor-crosshair"
                        : ""
                    }`}
                    style={{ aspectRatio: `${ratioAtual}` }}
                  >
                    <Image
                      key={fotoAtual}
                      src={fotoAtual}
                      alt=""
                      fill
                      sizes="272px"
                      className="object-cover"
                      onLoad={(e) =>
                        mediuFoto(
                          formato === "pc" && hero.fotoPc ? "pc" : "cel",
                          e.currentTarget.naturalWidth,
                          e.currentTarget.naturalHeight,
                        )
                      }
                    />
                    {/* Fora da faixa que sempre aparece: escurecido. */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background: "rgba(0,0,0,.55)",
                        clipPath: `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${faixa.x0}% ${faixa.y0}%, ${faixa.x0}% ${faixa.y1}%, ${faixa.x1}% ${faixa.y1}%, ${faixa.x1}% ${faixa.y0}%, ${faixa.x0}% ${faixa.y0}%)`,
                      }}
                    />
                    {/* Onde o título fica por cima: a parte de baixo (no
                        computador, só a metade esquerda). */}
                    {
                      <div
                        aria-hidden
                        className="pointer-events-none absolute"
                        style={{
                          left: `${faixa.x0}%`,
                          width: `${(faixa.x1 - faixa.x0) * (formato === "cel" ? 1 : 0.6)}%`,
                          top: `${faixa.y0 + (faixa.y1 - faixa.y0) * (formato === "cel" ? 0.58 : 0.5)}%`,
                          bottom: `${100 - faixa.y1}%`,
                          background:
                            "repeating-linear-gradient(135deg, rgba(0,0,0,.35) 0 6px, rgba(0,0,0,.15) 6px 12px)",
                        }}
                      />
                    }
                    {formato === "cel" && (
                      <EtiquetasDaFoto
                        animar={false}
                        ratio={ratioAtual}
                        tags={hero.tags.flatMap((t) =>
                          t.cel ? [{ label: t.label, pos: t.cel }] : [],
                        )}
                      />
                    )}
                    {formato === "cel" &&
                      sel != null &&
                      hero.tags[sel]?.cel && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute -ml-3 -mt-3 h-6 w-6 rounded-full ring-2 ring-accent ring-offset-1 ring-offset-white"
                          style={{
                            left: `${hero.tags[sel][formato]!.x}%`,
                            top: `${hero.tags[sel][formato]!.y}%`,
                          }}
                        />
                      )}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    {formato === "cel"
                      ? "A parte escura pode ficar fora da tela nos celulares mais estreitos; a listrada é onde o título fica por cima."
                      : "A parte escura pode ficar fora da tela em monitores mais baixos."}
                  </p>

                  {formato === "cel" ? (
                    <p className="mt-3 text-xs leading-relaxed text-muted">
                      <button
                        type="button"
                        onClick={() => setPicker({ tipo: "hero" })}
                        className="font-semibold text-foreground underline underline-offset-4"
                      >
                        Trocar foto
                      </button>{" "}
                      — vale para o celular e, sem foto própria, para o
                      computador. Use foto de corpo inteiro com fundo limpo em
                      volta do modelo.
                    </p>
                  ) : (
                    <p className="mt-3 text-xs leading-relaxed text-muted">
                      {hero.fotoPc ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setPicker({ tipo: "heroPc" })}
                            className="font-semibold text-foreground underline underline-offset-4"
                          >
                            Trocar foto do computador
                          </button>{" "}
                          ou{" "}
                          <button
                            type="button"
                            onClick={() => setHero({ fotoPc: null })}
                            className="font-semibold text-foreground underline underline-offset-4"
                          >
                            usar a mesma do celular
                          </button>
                          .
                        </>
                      ) : (
                        <>
                          Usa a mesma foto do celular.{" "}
                          <button
                            type="button"
                            onClick={() => setPicker({ tipo: "heroPc" })}
                            className="font-semibold text-foreground underline underline-offset-4"
                          >
                            Usar outra foto no computador
                          </button>
                        </>
                      )}
                    </p>
                  )}

                  <label className="mt-4 block text-sm font-medium">
                    Enquadramento
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={cortaLados ? focoAtual.fx : focoAtual.fy}
                      onChange={(e) =>
                        setFoco(
                          cortaLados
                            ? { fx: Number(e.target.value) }
                            : { fy: Number(e.target.value) },
                        )
                      }
                      className="mt-2 block w-full accent-[var(--accent)]"
                    />
                    <span className="flex justify-between text-xs font-normal text-muted">
                      {cortaLados ? (
                        <>
                          <span>mostrar a esquerda</span>
                          <span>mostrar a direita</span>
                        </>
                      ) : (
                        <>
                          <span>mostrar o alto</span>
                          <span>mostrar o pé</span>
                        </>
                      )}
                    </span>
                  </label>
                  <label className="mt-4 block text-sm font-medium">
                    Descrição da foto
                    <input
                      value={
                        formato === "pc" && hero.fotoPc
                          ? hero.fotoPc.alt
                          : hero.alt
                      }
                      maxLength={LIMITES.alt}
                      onChange={(e) =>
                        formato === "pc" && hero.fotoPc
                          ? setHero({
                              fotoPc: { ...hero.fotoPc, alt: e.target.value },
                            })
                          : setHero({ alt: e.target.value })
                      }
                      placeholder="Ex.: modelo de polo azul e calça bege"
                      className={`${campo} mt-1.5 font-normal`}
                    />
                    <span className="mt-1 block text-xs font-normal text-muted">
                      Lida por quem usa leitor de tela.
                    </span>
                  </label>
                </div>

                <div className="min-w-0 space-y-5">
                  {formato === "pc" ? (
                    <p className="rounded-xs bg-surface px-3 py-2.5 text-sm text-muted">
                      No computador a foto aparece limpa, sem etiquetas. Elas
                      aparecem só no celular (aba Celular).
                    </p>
                  ) : (
                    <div>
                      <p className="mb-2 text-sm font-medium">
                        Etiquetas no celular
                      </p>
                      <ul className="space-y-2">
                        {hero.tags.map((t, i) => {
                          const ativa = sel === i;
                          const pos = t[formato];
                          return (
                            <li
                              key={i}
                              onClick={() => setSel(i)}
                              className={`rounded-xs border px-3 py-2.5 ${
                                ativa ? "border-foreground" : "border-border"
                              } ${pos ? "" : "opacity-70"}`}
                            >
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => setSel(ativa ? null : i)}
                                  aria-pressed={ativa}
                                  aria-label={`Selecionar a etiqueta ${t.label} para mover`}
                                  className={`h-3.5 w-3.5 shrink-0 rounded-full ring-[3px] ${
                                    pos ? "bg-accent" : "bg-border"
                                  } ${ativa ? "ring-accent/30" : "ring-transparent"}`}
                                />
                                <div className="min-w-0 flex-1">
                                  <input
                                    value={t.label}
                                    onChange={(e) =>
                                      renomearEtiqueta(i, e.target.value)
                                    }
                                    onFocus={() => setSel(i)}
                                    aria-label="Texto da etiqueta"
                                    className="w-full bg-transparent text-sm font-medium outline-none"
                                  />
                                  <p className="text-xs text-muted">
                                    {!pos
                                      ? `não aparece no ${formato === "cel" ? "celular" : "computador"}`
                                      : ativa
                                        ? "selecionada: clique na foto para mover"
                                        : "clique para selecionar e mover"}
                                  </p>
                                </div>
                              </div>
                              {/* Controles numa linha própria: lado a lado com
                                o texto, o nome da etiqueta ficava espremido. */}
                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 pl-[1.625rem]">
                                {pos && (
                                  <div
                                    role="group"
                                    aria-label="Lado do rótulo"
                                    className="inline-flex overflow-hidden rounded-xs border border-border text-xs"
                                  >
                                    {(["e", "d"] as const).map((l) => (
                                      <button
                                        key={l}
                                        type="button"
                                        onClick={() => trocarLado(i, l)}
                                        aria-pressed={pos.lado === l}
                                        className={`px-2 py-1 ${
                                          pos.lado === l
                                            ? "bg-foreground text-background"
                                            : "hover:bg-surface"
                                        }`}
                                      >
                                        {l === "e" ? "Esq." : "Dir."}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    alternarNoFormato(i);
                                  }}
                                  className={linkAcao}
                                >
                                  {pos ? "esconder aqui" : "mostrar aqui"}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removerEtiqueta(i);
                                  }}
                                  className={linkAcao}
                                >
                                  remover
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      {hero.tags.length < MAX_ETIQUETAS && (
                        <button
                          type="button"
                          onClick={adicionarEtiqueta}
                          className="mt-3 text-sm font-semibold underline underline-offset-4"
                        >
                          + Adicionar etiqueta
                        </button>
                      )}
                      <p className="mt-1.5 text-xs text-muted">
                        Até {MAX_ETIQUETAS} etiquetas, só no celular. Textos
                        curtos funcionam melhor.
                      </p>
                    </div>
                  )}

                  <label className="block text-sm font-medium">
                    Título
                    <input
                      value={hero.title}
                      maxLength={LIMITES.titulo}
                      onChange={(e) => setHero({ title: e.target.value })}
                      className={`${campo} mt-1.5 font-normal`}
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Texto de apoio
                    <textarea
                      value={hero.text}
                      maxLength={LIMITES.texto}
                      rows={3}
                      onChange={(e) => setHero({ text: e.target.value })}
                      className={`${campo} mt-1.5 resize-y font-normal`}
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Peça da foto
                    <select
                      value={hero.look?.slug ?? ""}
                      onChange={(e) => {
                        const p = pecas.find((x) => x.slug === e.target.value);
                        setHero({
                          look: p ? { name: p.name, slug: p.slug } : null,
                        });
                      }}
                      className={`${campo} mt-1.5 font-normal`}
                    >
                      <option value="">Nenhuma (esconder a linha)</option>
                      {hero.look &&
                        !pecas.some((p) => p.slug === hero.look?.slug) && (
                          <option value={hero.look.slug}>
                            {hero.look.name}
                          </option>
                        )}
                      {pecas.map((p) => (
                        <option key={p.slug} value={p.slug}>
                          {p.name}
                          {p.active ? "" : " (fora da loja)"}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-xs font-normal text-muted">
                      Aparece como &ldquo;Na foto: …&rdquo; com link para a
                      peça.
                    </span>
                  </label>
                </div>
              </div>
            </section>
          </Panel>

          {/* ---------------- Faixa de avisos ---------------- */}
          <Panel className="p-5 lg:p-6">
            <section id="avisos" className="scroll-mt-6">
              <h2 className="font-display text-lg font-bold">
                Faixa de avisos
              </h2>
              <p className="mt-0.5 text-sm text-muted">
                As mensagens da faixa preta do topo, uma de cada vez. Desligue
                uma sem apagar.
              </p>
              <ul className="mt-4 space-y-2">
                {cfg.avisos.map((a, i) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 rounded-xs border border-border px-3 py-2.5"
                  >
                    <span className="flex flex-col leading-none">
                      <button
                        type="button"
                        onClick={() => moverAviso(i, -1)}
                        disabled={i === 0}
                        aria-label="Subir"
                        className="px-1 text-xs text-muted hover:text-foreground disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moverAviso(i, 1)}
                        disabled={i === cfg.avisos.length - 1}
                        aria-label="Descer"
                        className="px-1 text-xs text-muted hover:text-foreground disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </span>
                    <div className="min-w-0 flex-1">
                      {a.auto === "frete" ? (
                        <>
                          <p className="text-sm">
                            {textoAvisoFrete(freteAtivo)}
                          </p>
                          <p className="text-xs text-muted">
                            Automática: com a cotação de frete ligada diz
                            &ldquo;{textoAvisoFrete(true)}&rdquo;; sem ela,
                            &ldquo;{textoAvisoFrete(false)}&rdquo;. Hoje a
                            cotação está {freteAtivo ? "ligada" : "desligada"}.
                          </p>
                        </>
                      ) : (
                        <input
                          value={a.text}
                          maxLength={LIMITES.aviso}
                          onChange={(e) =>
                            setAvisos((l) =>
                              l.map((x, j) =>
                                j === i ? { ...x, text: e.target.value } : x,
                              ),
                            )
                          }
                          placeholder="Texto da mensagem"
                          aria-label="Texto da mensagem"
                          className="w-full bg-transparent text-sm outline-none"
                        />
                      )}
                    </div>
                    <Interruptor
                      ligado={a.active}
                      rotulo={a.active ? "Ligada" : "Desligada"}
                      onChange={() =>
                        setAvisos((l) =>
                          l.map((x, j) =>
                            j === i ? { ...x, active: !x.active } : x,
                          ),
                        )
                      }
                    />
                    {a.auto ? (
                      <span className="w-[3.75rem]" />
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setAvisos((l) => l.filter((_, j) => j !== i))
                        }
                        className={`${linkAcao} w-[3.75rem]`}
                      >
                        remover
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {cfg.avisos.length < MAX_AVISOS && (
                <button
                  type="button"
                  onClick={() =>
                    setAvisos((l) => [
                      ...l,
                      {
                        id: `m${Date.now().toString(36)}`,
                        text: "",
                        active: true,
                      },
                    ])
                  }
                  className="mt-3 text-sm font-semibold underline underline-offset-4"
                >
                  + Adicionar mensagem
                </button>
              )}
              <p className="mt-1.5 text-xs text-muted">
                Até {MAX_AVISOS} mensagens; cada uma fica 4 segundos. Mensagem
                sem texto não é salva.
              </p>
            </section>
          </Panel>

          {/* ---------------- Atalhos de categoria ---------------- */}
          <Panel className="p-5 lg:p-6">
            <section id="atalhos" className="scroll-mt-6">
              <h2 className="font-display text-lg font-bold">
                Atalhos de categoria
              </h2>
              <p className="mt-0.5 text-sm text-muted">
                A fileira de fotos logo abaixo do destaque. Escolha quais
                aparecem e a ordem; a foto sai sozinha de uma peça da categoria,
                ou é uma que você escolher entre as fotos das peças dela (toque
                na foto). Categoria nova entra no fim, sozinha.
              </p>
              {categorias.length === 0 && (
                <p className="mt-4 text-sm text-muted">
                  Nenhuma categoria com peça à venda ainda.
                </p>
              )}
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {categorias.map((c, i) => {
                  const oculta = cfg.atalhos.ocultas.includes(c.id);
                  const escolhida = cfg.atalhos.fotos[c.id];
                  const foto = escolhida ?? c.image;
                  return (
                    <li
                      key={c.id}
                      className="rounded-xs border border-border p-2"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setPicker({ tipo: "atalho", id: c.id, nome: c.name })
                        }
                        aria-label={`Trocar a foto de ${c.name}`}
                        className={`relative block aspect-[3/4] w-full overflow-hidden rounded-xs bg-surface ${
                          oculta ? "opacity-40 grayscale" : ""
                        }`}
                      >
                        {foto ? (
                          <Image
                            src={foto}
                            alt=""
                            fill
                            sizes="200px"
                            className="object-cover"
                          />
                        ) : (
                          <ProductPlaceholder />
                        )}
                        {!oculta && (
                          <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
                            {numeros.get(c.id)}
                          </span>
                        )}
                      </button>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">
                          {c.name}
                        </span>
                        <Interruptor
                          ligado={!oculta}
                          rotulo={
                            oculta ? `${c.name} oculta` : `${c.name} visível`
                          }
                          onChange={() => alternarAtalho(c.id)}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
                        {oculta ? (
                          <span>oculta</span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moverAtalho(i, -1)}
                              disabled={i === 0}
                              aria-label={`Mover ${c.name} para trás`}
                              className="px-0.5 hover:text-foreground disabled:opacity-30"
                            >
                              ◀
                            </button>
                            <button
                              type="button"
                              onClick={() => moverAtalho(i, 1)}
                              disabled={i === categorias.length - 1}
                              aria-label={`Mover ${c.name} para a frente`}
                              className="px-0.5 hover:text-foreground disabled:opacity-30"
                            >
                              ▶
                            </button>
                            mover
                          </span>
                        )}
                        <span>
                          {escolhida ? "foto escolhida" : "automática"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </Panel>
        </div>

        {/* ---------------- Prévia ---------------- */}
        {/* No celular a moldura (395 px) pode passar da tela: rola dentro dela. */}
        <aside className="min-w-0 overflow-x-auto xl:sticky xl:top-6 xl:self-start">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div
              role="group"
              aria-label="Prévia"
              className="inline-flex overflow-hidden rounded-xs border border-border text-xs"
            >
              {(
                [
                  ["cel", "Prévia no celular"],
                  ["pc", "No computador"],
                ] as const
              ).map(([f, rotulo]) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setPrevia(f)}
                  aria-pressed={previa === f}
                  className={`px-3 py-1.5 font-medium ${
                    previa === f
                      ? "bg-foreground text-background"
                      : "hover:bg-surface"
                  }`}
                >
                  {rotulo}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">atualiza enquanto você edita</p>
          </div>
          <PhonePreview key={previa} formato={previa}>
            <AnnouncementBar avisos={cfg.avisos} freteAtivo={freteAtivo} />
            <SiteHeader
              categories={props.menu}
              femininoEmBreve={!temFeminino}
              whatsappUrl={props.whatsappUrl}
            />
            <main className="flex-1">
              <HomeHero hero={hero} temFeminino={temFeminino} />
              <CategoryStrip covers={aplicaAtalhos(covers, cfg.atalhos)} />
            </main>
          </PhonePreview>
          <p className="mt-2 text-xs text-muted">
            A prévia usa o que está na tela. A loja só muda quando você toca em
            Publicar.
          </p>
        </aside>
      </div>

      {picker?.tipo === "hero" && (
        <PhotoPicker
          title="Foto do destaque principal"
          photos={photos}
          selected={hero.image}
          permiteEnviar
          onClose={() => setPicker(null)}
          onPick={(url, p) => {
            setHero({
              image: url,
              alt: p ? `${p.productName}${p.color ? `, ${p.color}` : ""}` : "",
              // Foto de uma peça: o "Na foto" passa a ser ela (dá para trocar).
              ...(p?.slug
                ? { look: { name: p.productName, slug: p.slug } }
                : {}),
            });
            setPicker(null);
          }}
        />
      )}
      {picker?.tipo === "heroPc" && (
        <PhotoPicker
          title="Foto do destaque no computador"
          photos={photos}
          selected={hero.fotoPc?.image ?? null}
          permiteEnviar
          onClose={() => setPicker(null)}
          onPick={(url, p) => {
            setHero({
              fotoPc: {
                image: url,
                alt: p
                  ? `${p.productName}${p.color ? `, ${p.color}` : ""}`
                  : "",
                // Provisória: a foto informa a proporção real ao carregar.
                ratio: hero.fotoPc?.ratio ?? hero.ratio,
              },
            });
            setFormato("pc");
            setPicker(null);
          }}
        />
      )}
      {picker?.tipo === "atalho" && (
        <PhotoPicker
          title={`Foto do atalho ${picker.nome}`}
          photos={photos.filter((p) => p.categoryId === picker.id)}
          selected={cfg.atalhos.fotos[picker.id] ?? null}
          extra={
            <button
              type="button"
              onClick={() => {
                fotoDoAtalho(picker.id, null);
                setPicker(null);
              }}
              className="inline-flex h-10 items-center rounded-xs border border-border px-4 text-sm font-medium hover:border-foreground"
            >
              Usar a automática
            </button>
          }
          onClose={() => setPicker(null)}
          onPick={(url) => {
            fotoDoAtalho(picker.id, url);
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}

/** Liga/desliga (switch). */
function Interruptor({
  ligado,
  rotulo,
  onChange,
}: {
  ligado: boolean;
  rotulo: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      onClick={onChange}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
        ligado ? "bg-foreground" : "bg-border"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-[left] ${
          ligado ? "left-[1.125rem]" : "left-0.5"
        }`}
      />
    </button>
  );
}
