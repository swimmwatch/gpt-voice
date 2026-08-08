import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  PiArrowCounterClockwise,
  PiBrain,
  PiCaretDown,
  PiCaretRight,
  PiCheckCircle,
  PiCloudArrowUp,
  PiCpu,
  PiCube,
  PiDatabase,
  PiDotsThreeVertical,
  PiFloppyDisk,
  PiGear,
  PiHardDrives,
  PiInfo,
  PiMemory,
  PiMinus,
  PiPause,
  PiPlay,
  PiShieldCheck,
  PiSlidersHorizontal,
  PiSquare,
  PiTag,
  PiTerminalWindow,
  PiTrash,
  PiWarningCircle,
  PiWaveform,
  PiX,
} from "react-icons/pi";
import { SiNvidia } from "react-icons/si";

type ModelId = "tiny" | "base" | "small" | "medium" | "large-v3" | "large-v3-turbo";
type TransferState = "running" | "paused" | "cancelled" | "complete";
type MemoryState = "unloaded" | "checking" | "loading" | "loaded";
type MenuId = "engine" | "model" | `row-${ModelId}` | null;

interface ModelOption {
  id: ModelId;
  label: string;
  quantization?: string;
  ram: string;
  vram: string;
  requiredRam: number;
  requiredVram: number;
}

const MODELS: readonly ModelOption[] = [
  { id: "tiny", label: "tiny", ram: "~2 GiB", vram: "~1–2 GiB", requiredRam: 2, requiredVram: 2 },
  { id: "base", label: "base", ram: "~2–4 GiB", vram: "~1–2 GiB", requiredRam: 4, requiredVram: 2 },
  { id: "small", label: "small", ram: "~4–6 GiB", vram: "~2–3 GiB", requiredRam: 6, requiredVram: 3 },
  { id: "medium", label: "medium", ram: "~6–10 GiB", vram: "~3–6 GiB", requiredRam: 10, requiredVram: 6 },
  { id: "large-v3", label: "large-v3", ram: "~10–16 GiB", vram: "~6–8 GiB", requiredRam: 16, requiredVram: 8 },
  {
    id: "large-v3-turbo",
    label: "large-v3-turbo",
    quantization: "Q5_0",
    ram: "~6–10 GiB",
    vram: "~3–6 GiB",
    requiredRam: 2.1,
    requiredVram: 7.2,
  },
] as const;

const SAFE_RAM_GIB = 11.8;
const SAFE_VRAM_GIB = 9.6;
const AVAILABLE_RAM_GIB = 15.2;
const AVAILABLE_VRAM_GIB = 12;

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

interface IconButtonProps {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  pressed?: boolean;
  className?: string;
}

function IconButton({ label, children, onClick, pressed, className }: IconButtonProps) {
  return (
    <button
      type="button"
      className={classNames("icon-button", className)}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

interface OverflowMenuProps {
  id: Exclude<MenuId, null>;
  openMenu: MenuId;
  setOpenMenu: (menu: MenuId) => void;
  removeLabel: string;
  onRemove: () => void;
}

function OverflowMenu({ id, openMenu, setOpenMenu, removeLabel, onRemove }: OverflowMenuProps) {
  const open = openMenu === id;

  return (
    <div className="overflow-menu">
      <IconButton
        label="Open management menu"
        pressed={open}
        className="menu-trigger"
        onClick={() => setOpenMenu(open ? null : id)}
      >
        <PiDotsThreeVertical aria-hidden="true" />
      </IconButton>
      {open ? (
        <div className="menu-popover" role="menu">
          <button type="button" role="menuitem" onClick={() => setOpenMenu(null)}>
            <PiInfo aria-hidden="true" />
            View details
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger-menu-item"
            onClick={() => {
              onRemove();
              setOpenMenu(null);
            }}
          >
            <PiTrash aria-hidden="true" />
            {removeLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface ReadinessStepProps {
  label: string;
  state: string;
  tone: "success" | "warning" | "active";
  last?: boolean;
}

function ReadinessStep({ label, state, tone, last }: ReadinessStepProps) {
  const StatusIcon = tone === "warning" ? PiWarningCircle : PiCheckCircle;

  return (
    <div className="readiness-step">
      <StatusIcon className={`readiness-icon ${tone}`} aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <span>{state}</span>
      </div>
      {!last ? <PiCaretRight className="readiness-divider" aria-hidden="true" /> : null}
    </div>
  );
}

interface DisclosureProps {
  title: string;
  icon?: IconType;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}

function Disclosure({ title, icon: SectionIcon, summary, open, onToggle, children, className }: DisclosureProps) {
  return (
    <section className={classNames("disclosure", className, open && "is-open")}>
      <button type="button" className="disclosure-trigger" aria-expanded={open} onClick={onToggle}>
        <span className="disclosure-title">
          {SectionIcon ? <SectionIcon aria-hidden="true" /> : null}
          <strong>{title}</strong>
          {summary ? <span>{summary}</span> : null}
        </span>
        {open ? <PiCaretDown aria-hidden="true" /> : <PiCaretRight aria-hidden="true" />}
      </button>
      {open ? <div className="disclosure-content">{children}</div> : null}
    </section>
  );
}

interface DetailItemProps {
  icon: IconType;
  label: string;
  value: string;
  accent?: "nvidia" | "blue" | "purple" | "green";
  title?: string;
}

function DetailItem({ icon: ItemIcon, label, value, accent, title }: DetailItemProps) {
  return (
    <div className="detail-item" title={title}>
      <span className={classNames("detail-icon", accent && `accent-${accent}`)}>
        <ItemIcon aria-hidden="true" />
      </span>
      <span className="detail-copy">
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
      {title ? <PiInfo className="detail-info" aria-hidden="true" /> : null}
    </div>
  );
}

interface ResourceBarProps {
  label: string;
  available: number;
  safe: number;
  required: number;
  tone: "ram" | "vram";
}

function ResourceBar({ label, available, safe, required, tone }: ResourceBarProps) {
  const safeWidth = Math.min(100, (safe / available) * 100);
  const requiredWidth = Math.min(100, (required / available) * 100);

  return (
    <div className="resource-meter">
      <div className="resource-meter-heading">
        <strong>{label}</strong>
        <span>{available.toFixed(1)} GiB available</span>
      </div>
      <div className="capacity-track" aria-label={`${label}: ${required} GiB required, ${safe} GiB safe to reserve`}>
        <span className={`safe-capacity ${tone}`} style={{ width: `${safeWidth}%` }} />
        <span className={`required-capacity ${tone}`} style={{ width: `${requiredWidth}%` }} />
        <span className="safe-marker" style={{ left: `${safeWidth}%` }} />
      </div>
      <div className="resource-meter-meta">
        <span>{safe.toFixed(1)} GiB safe to reserve</span>
        <span>{required.toFixed(1)} GiB required</span>
      </div>
    </div>
  );
}

interface TransferStatusProps {
  title: string;
  action: string;
  percent: number;
  bytes: string;
  transfer: string;
  state: TransferState;
  onStateChange: (state: TransferState) => void;
}

function TransferStatus({ title, action, percent, bytes, transfer, state, onStateChange }: TransferStatusProps) {
  const stateLabel =
    state === "paused" ? `${action} paused` : state === "cancelled" ? `${action} cancelled` : state === "complete" ? "Ready" : title;
  const shownPercent = state === "complete" ? 100 : percent;

  return (
    <div className={classNames("transfer-field", state !== "running" && `is-${state}`)}>
      <div className="transfer-heading">
        <strong>{stateLabel}</strong>
        <span>{shownPercent}%</span>
      </div>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={shownPercent}>
        <span style={{ width: `${shownPercent}%` }} />
      </div>
      <div className="transfer-meta">
        <span>{state === "complete" ? "Complete" : bytes}</span>
        <span>{state === "paused" ? "Transfer paused" : state === "cancelled" ? "No data is being transferred" : transfer}</span>
      </div>
      <div className="transfer-actions">
        {state === "cancelled" ? (
          <button type="button" className="compact-button" onClick={() => onStateChange("running")}>
            <PiPlay aria-hidden="true" />
            Retry
          </button>
        ) : state !== "complete" ? (
          <>
            <button
              type="button"
              className="compact-button"
              onClick={() => onStateChange(state === "paused" ? "running" : "paused")}
            >
              {state === "paused" ? <PiPlay aria-hidden="true" /> : <PiPause aria-hidden="true" />}
              {state === "paused" ? "Resume" : "Pause"}
            </button>
            <button type="button" className="compact-button" onClick={() => onStateChange("cancelled")}>
              <PiX aria-hidden="true" />
              Cancel
            </button>
          </>
        ) : null}
        <button type="button" className="link-button">
          Details
        </button>
      </div>
    </div>
  );
}

interface SectionHeadingProps {
  icon: IconType;
  title: string;
  children?: ReactNode;
}

function SectionHeading({ icon: HeadingIcon, title, children }: SectionHeadingProps) {
  return (
    <div className="section-heading">
      <span>
        <HeadingIcon aria-hidden="true" />
        <strong>{title}</strong>
      </span>
      {children}
    </div>
  );
}

interface EngineSectionProps {
  installed: boolean;
  transferState: TransferState;
  onTransferStateChange: (state: TransferState) => void;
  openMenu: MenuId;
  setOpenMenu: (menu: MenuId) => void;
  onRemove: () => void;
  onRestore: () => void;
  markDirty: () => void;
}

function EngineSection({
  installed,
  transferState,
  onTransferStateChange,
  openMenu,
  setOpenMenu,
  onRemove,
  onRestore,
  markDirty,
}: EngineSectionProps) {
  return (
    <section className="panel engine-section">
      <SectionHeading icon={PiGear} title="Engine backend">
        {installed ? (
          <OverflowMenu
            id="engine"
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            removeLabel="Remove engine"
            onRemove={onRemove}
          />
        ) : null}
      </SectionHeading>
      <div className="engine-layout">
        <div className="engine-controls">
          {installed ? (
            <>
              <label>
                <span>Backend</span>
                <span className="select-control">
                  <SiNvidia aria-hidden="true" />
                  <select name="backend" aria-label="Backend" defaultValue="cuda" onChange={markDirty}>
                    <option value="cuda">CUDA (NVIDIA)</option>
                    <option value="cpu">CPU</option>
                  </select>
                  <PiCaretDown aria-hidden="true" />
                </span>
              </label>
              <span className="field-note">Compute capability 8.9</span>
              <label>
                <span>Runtime revision</span>
                <span className="input-with-info">
                  <input name="runtimeRevision" value="whisper.cpp v1.7.4 (CUDA)" readOnly />
                  <PiInfo title="Installed runtime revision" aria-hidden="true" />
                </span>
              </label>
              <label>
                <span>Device</span>
                <span className="select-control no-brand">
                  <PiCpu aria-hidden="true" />
                  <select name="device" aria-label="Device" defaultValue="gpu-1" onChange={markDirty}>
                    <option value="gpu-1">NVIDIA GPU 1 (RTX 4090 24GB)</option>
                    <option value="cpu">System CPU</option>
                  </select>
                  <PiCaretDown aria-hidden="true" />
                </span>
              </label>
            </>
          ) : (
            <div className="empty-inline">
              <PiGear aria-hidden="true" />
              <div>
                <strong>Engine removed</strong>
                <span>Install a backend before loading a model.</span>
              </div>
              <button type="button" className="secondary-button" onClick={onRestore}>
                Install CUDA engine
              </button>
            </div>
          )}
        </div>
        {installed ? (
          <div className="status-column">
            <span className="field-label">Install status</span>
            <TransferStatus
              title="Verifying package"
              action="Installation"
              percent={78}
              bytes="412 MB / 528 MB"
              transfer="24.8 MB/s · 5s remaining"
              state={transferState}
              onStateChange={onTransferStateChange}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

interface ModelSectionProps {
  selectedModel: ModelOption;
  onSelectModel: (model: ModelOption) => void;
  installed: boolean;
  transferState: TransferState;
  onTransferStateChange: (state: TransferState) => void;
  openMenu: MenuId;
  setOpenMenu: (menu: MenuId) => void;
  onRemove: () => void;
  onRestore: () => void;
}

function ModelSection({
  selectedModel,
  onSelectModel,
  installed,
  transferState,
  onTransferStateChange,
  openMenu,
  setOpenMenu,
  onRemove,
  onRestore,
}: ModelSectionProps) {
  const selectedDisplayName = selectedModel.id === "large-v3-turbo" ? "Large v3 Turbo" : selectedModel.label;

  return (
    <section className="panel model-section">
      <SectionHeading icon={PiCube} title="Model" />
      <div className="model-layout">
        <div className="selected-model-control">
          <button type="button" className="model-selector" onClick={() => setOpenMenu(openMenu === "model" ? null : "model")}>
            <PiCube aria-hidden="true" />
            <span>
              <strong>{selectedDisplayName}</strong>
              {selectedModel.quantization ? <span> · {selectedModel.quantization}</span> : null}
            </span>
            <span
              className={classNames("artifact-state", installed ? "installed" : "missing")}
              title={installed ? "Downloaded" : "Not downloaded"}
            >
              {installed ? <PiCheckCircle aria-hidden="true" /> : <PiWarningCircle aria-hidden="true" />}
              <span className="visually-hidden">{installed ? "Downloaded" : "Not downloaded"}</span>
            </span>
            <PiCaretDown aria-hidden="true" />
          </button>
          {installed ? (
            <OverflowMenu
              id="model"
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              removeLabel="Remove model"
              onRemove={onRemove}
            />
          ) : (
            <button type="button" className="secondary-button full-width" onClick={onRestore}>
              Download model
            </button>
          )}
        </div>
        {installed ? (
          <div className="status-column">
            <span className="field-label">Download status</span>
            <TransferStatus
              title="Downloading model"
              action="Download"
              percent={61}
              bytes="334 MB / 547 MB"
              transfer="18.4 MB/s · 12s remaining"
              state={transferState}
              onStateChange={onTransferStateChange}
            />
          </div>
        ) : null}
      </div>

      <div className="model-table" role="table" aria-label="Available Local Whisper models">
        <div className="model-table-header" role="row">
          <span role="columnheader">Model</span>
          <span role="columnheader">RAM</span>
          <span role="columnheader">VRAM</span>
          <span role="columnheader" className="visually-hidden">Actions</span>
        </div>
        {MODELS.map((model) => {
          const selected = model.id === selectedModel.id;
          return (
            <div
              key={model.id}
              className={classNames("model-row", selected && "selected")}
              role="row"
              onClick={() => onSelectModel(model)}
            >
              <button
                type="button"
                className="model-name-cell"
                role="cell"
                aria-label={`Select ${model.label}`}
                aria-pressed={selected}
              >
                <span className="radio-mark" aria-hidden="true" />
                <PiCube aria-hidden="true" />
                <strong>{model.label}</strong>
                {model.quantization ? <span>· {model.quantization}</span> : null}
              </button>
              <span role="cell" data-label="RAM">{model.ram}</span>
              <span role="cell" data-label="VRAM">{model.vram}</span>
              <span role="cell" className="row-action" onClick={(event) => event.stopPropagation()}>
                <OverflowMenu
                  id={`row-${model.id}`}
                  openMenu={openMenu}
                  setOpenMenu={setOpenMenu}
                  removeLabel="Remove model"
                  onRemove={onRemove}
                />
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function App() {
  const [technicalDetailsOpen, setTechnicalDetailsOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<ModelId>("large-v3-turbo");
  const [engineInstalled, setEngineInstalled] = useState(true);
  const [modelInstalled, setModelInstalled] = useState(true);
  const [engineTransfer, setEngineTransfer] = useState<TransferState>("running");
  const [modelTransfer, setModelTransfer] = useState<TransferState>("running");
  const [memoryState, setMemoryState] = useState<MemoryState>("unloaded");
  const [openMenu, setOpenMenu] = useState<MenuId>(null);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedModel = useMemo(
    () => MODELS.find((model) => model.id === selectedModelId) ?? MODELS[MODELS.length - 1],
    [selectedModelId],
  );
  const safeToLoad = selectedModel.requiredRam <= SAFE_RAM_GIB && selectedModel.requiredVram <= SAFE_VRAM_GIB;
  const connected = memoryState === "loaded" && engineInstalled && modelInstalled;

  useEffect(() => {
    if (memoryState !== "checking" && memoryState !== "loading") {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setMemoryState((current) => (current === "checking" ? "loading" : "loaded"));
    }, 850);

    return () => window.clearTimeout(timeout);
  }, [memoryState]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }
    const timeout = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const beginLoad = () => {
    if (connected) {
      setMemoryState("unloaded");
      setNotice("Model freed from memory. Local Whisper is offline.");
      return;
    }
    if (!engineInstalled || !modelInstalled) {
      setNotice("Install the engine and download the model before loading.");
      return;
    }
    if (!safeToLoad) {
      setNotice("Load blocked: safe memory headroom is unavailable.");
      return;
    }
    setMemoryState("checking");
    setNotice("Checking safe memory headroom before loading…");
  };

  const reset = () => {
    setSelectedModelId("large-v3-turbo");
    setEngineInstalled(true);
    setModelInstalled(true);
    setEngineTransfer("running");
    setModelTransfer("running");
    setMemoryState("unloaded");
    setDirty(false);
    setOpenMenu(null);
    setNotice("Defaults restored.");
  };

  const technicalDetails: DetailItemProps[] = [
    { icon: PiTerminalWindow, label: "Runtime", value: "Whisper.cpp" },
    { icon: SiNvidia, label: "Backend", value: engineInstalled ? "CUDA" : "Not installed", accent: "nvidia" },
    { icon: PiCpu, label: "Device", value: "NVIDIA GPU 1", accent: "green" },
    { icon: PiBrain, label: "Model", value: selectedModel.label === "large-v3-turbo" ? "Large v3 Turbo" : selectedModel.label, accent: "blue" },
    { icon: PiSlidersHorizontal, label: "Quantization", value: selectedModel.quantization ?? "Full", accent: "purple" },
    {
      icon: PiTag,
      label: "Revision",
      value: selectedModel.id === "large-v3-turbo" ? "whisper-cpp-large-v3…" : `${selectedModel.id}-full-v1`,
      accent: "blue",
      title: selectedModel.id === "large-v3-turbo" ? "whisper-cpp-large-v3-turbo-q5_0-v1" : `${selectedModel.id}-full-v1`,
    },
  ];

  return (
    <div className="app-shell" onClick={() => openMenu && setOpenMenu(null)}>
      <div className="window-titlebar" onClick={(event) => event.stopPropagation()}>
        <span>GPT-Voice — Settings</span>
        <div className="window-controls" aria-label="Window controls">
          <IconButton label="Minimize"><PiMinus aria-hidden="true" /></IconButton>
          <IconButton label="Maximize"><PiSquare aria-hidden="true" /></IconButton>
          <IconButton label="Close"><PiX aria-hidden="true" /></IconButton>
        </div>
      </div>

      <main className="settings-page" onClick={(event) => event.stopPropagation()}>
        <header className="page-heading">
          <PiWaveform className="product-mark" aria-hidden="true" />
          <div>
            <h1>Local Whisper</h1>
            <p>Run Whisper.cpp locally with explicit model, backend, and memory lifecycle controls.</p>
          </div>
          <PiInfo className="heading-info" title="Local processing keeps audio and transcripts on this device." aria-hidden="true" />
        </header>

        <section className="readiness-rail" aria-label="Local Whisper readiness">
          <ReadinessStep label="Runtime" state={engineInstalled ? "Installed" : "Missing"} tone={engineInstalled ? "active" : "warning"} />
          <ReadinessStep label="Model" state={modelInstalled ? "Installed" : "Missing"} tone={modelInstalled ? "success" : "warning"} />
          <ReadinessStep label="Compatibility" state={safeToLoad ? "Validated" : "Blocked"} tone={safeToLoad ? "success" : "warning"} />
          <ReadinessStep
            label="Model state"
            state={memoryState === "loaded" ? "Loaded" : memoryState === "loading" ? "Loading" : "Unloaded"}
            tone={memoryState === "loaded" ? "success" : "warning"}
            last
          />
        </section>

        <section className={classNames("provider-banner", connected ? "connected" : "offline")}>
          {connected ? <PiCheckCircle aria-hidden="true" /> : <PiWarningCircle aria-hidden="true" />}
          <div>
            <strong>{connected ? "Connected" : memoryState === "checking" ? "Checking resources" : memoryState === "loading" ? "Loading model" : "Not connected"}</strong>
            <span>{connected ? "Local Whisper is ready for transcription." : "Local Whisper becomes available after a model is loaded."}</span>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={beginLoad}
            disabled={memoryState === "checking" || memoryState === "loading"}
          >
            {connected ? <PiMemory aria-hidden="true" /> : <PiCloudArrowUp aria-hidden="true" />}
            {connected ? "Free model" : memoryState === "checking" ? "Checking…" : memoryState === "loading" ? "Loading…" : "Load model"}
          </button>
        </section>

        <Disclosure
          title="Technical details"
          open={technicalDetailsOpen}
          onToggle={() => setTechnicalDetailsOpen((open) => !open)}
          className="technical-disclosure"
        >
          <div className="technical-grid">
            {technicalDetails.map((item) => (
              <DetailItem key={item.label} {...item} />
            ))}
          </div>
        </Disclosure>

        <section className="panel resource-panel">
          <SectionHeading icon={PiShieldCheck} title="Resource safety">
            <span className={classNames("safety-verdict", safeToLoad ? "safe" : "blocked")}>
              {safeToLoad ? <PiShieldCheck aria-hidden="true" /> : <PiWarningCircle aria-hidden="true" />}
              {safeToLoad ? "Safe to load" : "Load blocked"}
            </span>
          </SectionHeading>
          <div className="resource-grid">
            <ResourceBar label="System RAM" available={AVAILABLE_RAM_GIB} safe={SAFE_RAM_GIB} required={selectedModel.requiredRam} tone="ram" />
            <ResourceBar label="GPU VRAM" available={AVAILABLE_VRAM_GIB} safe={SAFE_VRAM_GIB} required={selectedModel.requiredVram} tone="vram" />
          </div>
          <div className="requirement-row">
            <PiCube aria-hidden="true" />
            <span>Model requirement</span>
            <strong>{selectedModel.requiredVram.toFixed(1)} GiB VRAM + {selectedModel.requiredRam.toFixed(1)} GiB RAM</strong>
          </div>
          <div className={classNames("safety-note", safeToLoad ? "safe" : "blocked")}>
            {safeToLoad ? <PiShieldCheck aria-hidden="true" /> : <PiWarningCircle aria-hidden="true" />}
            <span>
              Rechecked immediately before loading. Loading is blocked if safe headroom is unavailable.
            </span>
          </div>
        </section>

        <EngineSection
          installed={engineInstalled}
          transferState={engineTransfer}
          onTransferStateChange={setEngineTransfer}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          onRemove={() => {
            setEngineInstalled(false);
            setMemoryState("unloaded");
            setDirty(true);
            setNotice("CUDA engine removed.");
          }}
          onRestore={() => {
            setEngineInstalled(true);
            setEngineTransfer("running");
            setDirty(true);
          }}
          markDirty={() => setDirty(true)}
        />

        <ModelSection
          selectedModel={selectedModel}
          onSelectModel={(model) => {
            setSelectedModelId(model.id);
            setMemoryState("unloaded");
            setDirty(true);
            setOpenMenu(null);
          }}
          installed={modelInstalled}
          transferState={modelTransfer}
          onTransferStateChange={setModelTransfer}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          onRemove={() => {
            setModelInstalled(false);
            setMemoryState("unloaded");
            setDirty(true);
            setNotice("Selected model removed from storage.");
          }}
          onRestore={() => {
            setModelInstalled(true);
            setModelTransfer("running");
            setDirty(true);
          }}
        />

        <Disclosure
          title="Transcription & advanced"
          icon={PiSlidersHorizontal}
          summary="English · Prompt: (none) · Temp: 0.0 · Greedy · Beam: 5 · Best of: 5 · CPU threads: Auto"
          open={advancedOpen}
          onToggle={() => setAdvancedOpen((open) => !open)}
        >
          <div className="advanced-grid">
            <label>Language<select name="language" defaultValue="en" onChange={() => setDirty(true)}><option value="en">English</option><option value="auto">Auto-detect</option></select></label>
            <label>Temperature<input name="temperature" type="number" defaultValue="0.0" step="0.1" onChange={() => setDirty(true)} /></label>
            <label>CPU threads<select name="cpuThreads" defaultValue="auto" onChange={() => setDirty(true)}><option value="auto">Auto</option><option value="8">8</option><option value="16">16</option></select></label>
          </div>
        </Disclosure>

        <Disclosure
          title="Storage"
          icon={PiDatabase}
          summary="4.47 GiB used · 7 installed artifacts"
          open={storageOpen}
          onToggle={() => setStorageOpen((open) => !open)}
        >
          <div className="storage-summary">
            <PiHardDrives aria-hidden="true" />
            <div><strong>Local Whisper storage</strong><span>Runtime packages, model files, and verification metadata.</span></div>
            <button type="button" className="secondary-button">Open folder</button>
          </div>
        </Disclosure>

        <footer className="page-actions">
          <button type="button" className="secondary-button" onClick={reset}>
            <PiArrowCounterClockwise aria-hidden="true" />
            Reset to defaults
          </button>
          <div>
            <button
              type="button"
              className="primary-button"
              disabled={!dirty}
              onClick={() => {
                setDirty(false);
                setNotice("Settings saved.");
              }}
            >
              <PiFloppyDisk aria-hidden="true" />
              Save settings
            </button>
            <span>{dirty ? "You have unsaved changes." : "No unsaved changes."}</span>
          </div>
        </footer>
      </main>

      {notice ? <div className="toast" role="status">{notice}</div> : null}
    </div>
  );
}
