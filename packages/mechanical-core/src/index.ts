/** Deterministic headless engine: dependency planning, staged animation, atomic effects, undo/redo. */
import {
  add, lerp, validateAsset, zero,
  type MechanicalAsset, type Operation, type OperationPlan,
  type Predicate, type Effect, type Vec3, type PartStatus, type MateStatus
} from "../../mechanical-schema/src/index.js";
import { inspectMotion, mateAlignment, screwPreview, jointPreview } from "./p1.js";

export interface RuntimeState {
  revision: number;
  partStatus: Record<string, PartStatus>;
  mateStatus: Record<string, MateStatus>;
  offsets: Record<string, Vec3>;
  jointAngles: Record<string, number>;
  flags: Record<string, boolean>;
  committedOperationIds: string[];
}
export type EngineEvent =
  | { type: "commit"; operationId: string; revision: number }
  | { type: "preview"; operationId: string; progress: number; offsets: Record<string, Vec3>;
      jointAngles: Record<string, number>;
      screwRotations: Record<string, { axis: Vec3; angleRad: number }> }
  | { type: "diagnostic"; operationId: string; message: string; severity: "warning" | "error" }
  | { type: "state"; revision: number }
  | { type: "cancel"; operationId: string };
export interface AnimationDriver {
  play(durationMs: number, update: (progress: number) => void, signal?: AbortSignal): Promise<void>;
}
export const immediateDriver: AnimationDriver = {
  async play(_durationMs, update, signal) {
    if (signal?.aborted) throw new Error("Operation aborted");
    update(1);
  }
};
export class BlockedOperationError extends Error {
  constructor(public operationId: string, public blockers: string[]) {
    super("Operation blocked: " + operationId + " (" + blockers.join(", ") + ")");
  }
}
const clone = (s: RuntimeState): RuntimeState => structuredClone(s);
const matches = (state: RuntimeState, p: Predicate): boolean =>
  p.kind === "part" ? state.partStatus[p.id] === p.equals :
  p.kind === "mate" ? state.mateStatus[p.id] === p.equals :
  p.kind === "joint" ? Math.abs((state.jointAngles[p.id] ?? 0) - p.equalsRad) < 1e-6 :
  state.flags[p.id] === p.equals;
const effectSatisfied = (s: RuntimeState, e: Effect): boolean => {
  if (e.kind === "part") return s.partStatus[e.id] === e.state;
  if (e.kind === "mate") return s.mateStatus[e.id] === e.state;
  if (e.kind === "joint") return Math.abs((s.jointAngles[e.id] ?? 0) - e.angleRad) < 1e-6;
  const v = s.offsets[e.id] ?? zero();
  return v.every((n, i) => Math.abs(n - e.value[i]) < 1e-8);
};
const applyEffects = (s: RuntimeState, effects: Effect[]) => {
  for (const e of effects) {
    if (e.kind === "part") s.partStatus[e.id] = e.state;
    if (e.kind === "mate") s.mateStatus[e.id] = e.state;
    if (e.kind === "offset") s.offsets[e.id] = [...e.value];
    if (e.kind === "joint") s.jointAngles[e.id] = e.angleRad;
  }
};
function planOrder(plan: OperationPlan, operations: Map<string, Operation>): Operation[] {
  const result: Operation[] = [], done = new Set<string>();
  const visit = (id: string) => {
    if (done.has(id)) return;
    const op = operations.get(id);
    if (!op) throw new Error("Unknown operation " + id);
    for (const dep of op.dependsOn) visit(dep);
    done.add(id); result.push(op);
  };
  for (const id of plan.operationIds) visit(id);
  return result;
}
export class MechanicalEngine {
  private state: RuntimeState;
  private readonly initial: RuntimeState;
  private readonly ops: Map<string, Operation>;
  private readonly plans: Map<string, OperationPlan>;
  private readonly listeners = new Set<(event: EngineEvent) => void>();
  private undoStack: RuntimeState[] = [];
  private redoStack: RuntimeState[] = [];
  private busy = false;

  constructor(public readonly asset: MechanicalAsset, private readonly driver: AnimationDriver = immediateDriver) {
    const problems = validateAsset(asset).filter(i => i.severity === "error");
    if (problems.length) throw new Error(problems.map(i => i.code + ": " + i.path).join("; "));
    this.ops = new Map(asset.operations.map(op => [op.id, op]));
    this.plans = new Map(asset.plans.map(plan => [plan.id, plan]));
    const partStatus: RuntimeState["partStatus"] = {}, offsets: RuntimeState["offsets"] = {};
    for (const n of asset.nodes) if (n.kind === "part") {
      partStatus[n.id] = "installed";
      offsets[n.id] = zero();
    }
    this.initial = {
      revision: 0,
      partStatus,
      mateStatus: Object.fromEntries(asset.mates.map(m => [m.id, m.initialState])),
      offsets,
      jointAngles: Object.fromEntries((asset.joints ?? []).map(j => [j.id, j.initialRad])),
      flags: { ...(asset.flags ?? {}) },
      committedOperationIds: []
    };
    this.state = clone(this.initial);
  }
  getState(): Readonly<RuntimeState> { return clone(this.state); }
  isBusy(): boolean { return this.busy; }
  subscribe(fn: (event: EngineEvent) => void): () => void {
    this.listeners.add(fn); return () => this.listeners.delete(fn);
  }
  private emit(e: EngineEvent): void { for (const listener of this.listeners) listener(e); }
  listPlans(): OperationPlan[] { return [...this.plans.values()]; }
  operationsFor(planId: string): Operation[] {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error("Unknown plan " + planId);
    return planOrder(plan, this.ops);
  }
  isComplete(op: Operation): boolean {
    return op.effects.every(effect => effectSatisfied(this.state, effect));
  }
  progress(planId: string): { done: number; total: number; next?: Operation } {
    const ops = this.operationsFor(planId);
    return { done: ops.filter(o => this.isComplete(o)).length, total: ops.length,
      next: ops.find(o => !this.isComplete(o)) };
  }
  availableOperations(planId: string): Operation[] {
    const ops = this.operationsFor(planId);
    return ops.filter(op => !this.isComplete(op) &&
      op.dependsOn.every(id => this.isComplete(this.ops.get(id)!)) &&
      op.requires.every(p => matches(this.state, p)));
  }
  async runOperation(operationId: string, signal?: AbortSignal): Promise<void> {
    if (this.busy) throw new Error("Another operation is running");
    const op = this.ops.get(operationId);
    if (!op) throw new Error("Unknown operation " + operationId);
    if (this.isComplete(op)) return; // idempotent
    const blockers = [
      ...op.dependsOn.filter(id => !this.isComplete(this.ops.get(id)!)).map(id => "dependency " + id),
      ...op.requires.filter(p => !matches(this.state, p)).map(p => "guard " + p.kind + ":" + p.id)
    ];
    if (blockers.length) throw new BlockedOperationError(op.id, blockers);
    if (signal?.aborted) throw new Error("Operation aborted");
    this.busy = true;
    const start = clone(this.state);
    const target = clone(start);
    applyEffects(target, op.effects);
    const collision = inspectMotion(this.asset, start, target, op);
    if (collision && !collision.ok) {
      this.busy = false;
      throw new BlockedOperationError(op.id, [
        "new collision in " + collision.pathId + " (first obstacle: " +
        collision.contacts[0]?.obstaclePartId + ")"
      ]);
    }
    for (const e of op.effects) if (e.kind === "mate" && e.state === "locked") {
      const mate = this.asset.mates.find(m => m.id === e.id);
      if (mate?.verified && !mateAlignment(this.asset, target, e.id).acceptable) {
        this.busy = false;
        throw new BlockedOperationError(op.id, ["mate anchors misaligned: " + e.id]);
      }
    }
    if (collision && collision.contacts.length) this.emit({
      type: "diagnostic", operationId: op.id, severity: "warning",
      message: collision.contacts.length + " advisory proxy collision samples on " + collision.pathId
    });
    const preview = (t: number) => {
      const progress = Math.max(0, Math.min(1, t));
      const offsets: Record<string, Vec3> = {};
      for (const e of op.effects) if (e.kind === "offset")
        offsets[e.id] = lerp(start.offsets[e.id] ?? zero(), e.value, progress);
      this.emit({
        type: "preview", operationId, progress, offsets,
        jointAngles: jointPreview(op, start, progress),
        screwRotations: screwPreview(this.asset, op, progress)
      });
    };
    try {
      await this.driver.play(op.durationMs, preview, signal);
      if (signal?.aborted) throw new Error("Operation aborted");
      if (this.state.revision !== start.revision) throw new Error("Concurrent state revision");
      this.undoStack.push(start);
      this.redoStack = [];
      target.revision = start.revision + 1;
      target.committedOperationIds.push(op.id);
      this.state = target;
      this.emit({ type: "commit", operationId, revision: target.revision });
      this.emit({ type: "state", revision: target.revision });
    } catch (err) {
      this.state = start;
      this.emit({ type: "cancel", operationId });
      this.emit({ type: "state", revision: start.revision });
      throw err;
    } finally { this.busy = false; }
  }
  async step(planId: string, signal?: AbortSignal): Promise<Operation | null> {
    const next = this.progress(planId).next;
    if (!next) return null;
    await this.runOperation(next.id, signal);
    return next;
  }
  async runPlan(planId: string, signal?: AbortSignal): Promise<void> {
    for (const op of this.operationsFor(planId)) {
      if (signal?.aborted) throw new Error("Operation aborted");
      if (!this.isComplete(op)) await this.runOperation(op.id, signal);
    }
  }
  undo(): boolean {
    if (this.busy || !this.undoStack.length) return false;
    this.redoStack.push(clone(this.state));
    const state = this.undoStack.pop()!;
    state.revision = this.state.revision + 1;
    this.state = state;
    this.emit({ type: "state", revision: state.revision });
    return true;
  }
  redo(): boolean {
    if (this.busy || !this.redoStack.length) return false;
    this.undoStack.push(clone(this.state));
    const state = this.redoStack.pop()!;
    state.revision = this.state.revision + 1;
    this.state = state;
    this.emit({ type: "state", revision: state.revision });
    return true;
  }
  reset(): void {
    if (this.busy) throw new Error("Cannot reset during execution");
    this.undoStack.push(clone(this.state));
    this.redoStack = [];
    const next = clone(this.initial);
    next.revision = this.state.revision + 1;
    this.state = next;
    this.emit({ type: "state", revision: next.revision });
  }
}
