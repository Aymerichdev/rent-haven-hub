import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  User,
  Building,
  Unit,
  Amenity,
  Meter,
  RentalRequest,
  AmenityBooking,
  Contract,
  Payment,
  Role,
} from "./types";
import {
  seedUsers,
  seedBuildings,
  seedUnits,
  seedAmenities,
  seedMeters,
  seedRequests,
  seedBookings,
  seedContracts,
  seedPayments,
} from "./mock-data";

const uid = () => Math.random().toString(36).slice(2, 10);

export type DeleteResult = { ok: true } | { ok: false; reason: string };

interface AppState {
  currentUser: User | null;
  users: User[];
  buildings: Building[];
  units: Unit[];
  amenities: Amenity[];
  meters: Meter[];
  requests: RentalRequest[];
  bookings: AmenityBooking[];
  contracts: Contract[];
  payments: Payment[];

  // auth
  login: (email: string, password: string) => User | null;
  register: (data: Omit<User, "id" | "createdAt">) => User;
  logout: () => void;
  changePassword: (oldPwd: string, newPwd: string) => boolean;
  resetPassword: (email: string) => boolean;

  // users (admin)
  addUser: (u: Omit<User, "id" | "createdAt">) => void;
  updateUser: (id: string, patch: Partial<User>) => void;
  deleteUser: (id: string) => void;

  // buildings
  addBuilding: (b: Omit<Building, "id">) => string;
  updateBuilding: (id: string, patch: Partial<Building>) => void;
  /** Bloquea el borrado si el edificio tiene unidades. */
  deleteBuilding: (id: string) => DeleteResult;

  // units (entidad alquilable)
  addUnit: (u: Omit<Unit, "id">) => DeleteResult;
  updateUnit: (id: string, patch: Partial<Unit>) => void;
  deleteUnit: (id: string) => void;

  // amenities
  addAmenity: (a: Omit<Amenity, "id">) => void;
  updateAmenity: (id: string, patch: Partial<Amenity>) => void;
  deleteAmenity: (id: string) => void;

  // meters
  addMeter: (m: Omit<Meter, "id">) => void;
  deleteMeter: (id: string) => void;

  // requests / bookings
  createRentalRequest: (
    r: Omit<RentalRequest, "id" | "createdAt" | "status" | "ownerResponse" | "updatedAt">,
  ) => void;
  setRequestStatus: (
    id: string,
    status: RentalRequest["status"],
    ownerResponse?: string,
  ) => void;
  createBooking: (b: Omit<AmenityBooking, "id" | "status">) => void;
  setBookingStatus: (
    id: string,
    status: AmenityBooking["status"],
    ownerNote?: string,
  ) => void;

  // payments
  /** El inquilino sube un comprobante; pasa a "validating". */
  submitPaymentReceipt: (
    id: string,
    receipt: { dataUrl: string; name: string; type: string },
  ) => void;
  /** El owner aprueba el comprobante. */
  approvePayment: (id: string, ownerNote?: string) => void;
  /** El owner rechaza el comprobante (mensaje obligatorio). */
  rejectPayment: (id: string, ownerNote: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      users: seedUsers,
      buildings: seedBuildings,
      units: seedUnits,
      amenities: seedAmenities,
      meters: seedMeters,
      requests: seedRequests,
      bookings: seedBookings,
      contracts: seedContracts,
      payments: seedPayments,

      login: (email, password) => {
        const u = get().users.find(
          (x) => x.email.toLowerCase() === email.toLowerCase() && x.password === password,
        );
        if (u) set({ currentUser: u });
        return u ?? null;
      },
      register: (data) => {
        const u: User = { ...data, id: uid(), createdAt: new Date().toISOString().slice(0, 10) };
        set((s) => ({ users: [...s.users, u], currentUser: u }));
        return u;
      },
      logout: () => set({ currentUser: null }),
      changePassword: (oldPwd, newPwd) => {
        const cu = get().currentUser;
        if (!cu || cu.password !== oldPwd) return false;
        const updated = { ...cu, password: newPwd };
        set((s) => ({
          currentUser: updated,
          users: s.users.map((u) => (u.id === cu.id ? updated : u)),
        }));
        return true;
      },
      resetPassword: (email) => {
        return !!get().users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      },

      addUser: (u) =>
        set((s) => ({
          users: [
            ...s.users,
            { ...u, id: uid(), createdAt: new Date().toISOString().slice(0, 10) },
          ],
        })),
      updateUser: (id, patch) =>
        set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) })),
      deleteUser: (id) => set((s) => ({ users: s.users.filter((u) => u.id !== id) })),

      addBuilding: (b) => {
        const id = uid();
        set((s) => ({ buildings: [...s.buildings, { ...b, id }] }));
        return id;
      },
      updateBuilding: (id, patch) =>
        set((s) => ({
          buildings: s.buildings.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        })),
      deleteBuilding: (id) => {
        const unitsInBuilding = get().units.filter((u) => u.buildingId === id);
        if (unitsInBuilding.length > 0) {
          return {
            ok: false,
            reason: `Tiene ${unitsInBuilding.length} unidad(es). Bórralas o muévelas primero.`,
          };
        }
        set((s) => ({
          buildings: s.buildings.filter((b) => b.id !== id),
          amenities: s.amenities.filter((a) => a.buildingId !== id),
        }));
        return { ok: true };
      },

      addUnit: (u) => {
        if (u.buildingId) {
          const building = get().buildings.find((b) => b.id === u.buildingId);
          if (!building) return { ok: false, reason: "Edificio inválido" };
          if (building.ownerId !== u.ownerId)
            return { ok: false, reason: "El owner debe coincidir con el del edificio" };
          const dup = get().units.some(
            (x) =>
              x.buildingId === u.buildingId && x.number.trim() === u.number.trim(),
          );
          if (dup)
            return { ok: false, reason: "Ya existe una unidad con ese número en el edificio" };
        } else {
          if (!u.addressOverride?.trim() || !u.cityOverride?.trim())
            return {
              ok: false,
              reason: "Las unidades sin edificio requieren dirección y ciudad",
            };
        }
        set((s) => ({ units: [...s.units, { ...u, id: uid() }] }));
        return { ok: true };
      },
      updateUnit: (id, patch) =>
        set((s) => ({ units: s.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) })),
      deleteUnit: (id) => set((s) => ({ units: s.units.filter((u) => u.id !== id) })),

      addAmenity: (a) => set((s) => ({ amenities: [...s.amenities, { ...a, id: uid() }] })),
      updateAmenity: (id, patch) =>
        set((s) => ({
          amenities: s.amenities.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      deleteAmenity: (id) => set((s) => ({ amenities: s.amenities.filter((a) => a.id !== id) })),

      addMeter: (m) => set((s) => ({ meters: [...s.meters, { ...m, id: uid() }] })),
      deleteMeter: (id) => set((s) => ({ meters: s.meters.filter((m) => m.id !== id) })),

      createRentalRequest: (r) =>
        set((s) => ({
          requests: [
            ...s.requests,
            {
              ...r,
              id: uid(),
              status: "pending",
              createdAt: new Date().toISOString().slice(0, 10),
            },
          ],
        })),
      setRequestStatus: (id, status, ownerResponse) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status,
                  ownerResponse: ownerResponse ?? r.ownerResponse,
                  updatedAt: new Date().toISOString().slice(0, 10),
                }
              : r,
          ),
        })),

      createBooking: (b) =>
        set((s) => ({ bookings: [...s.bookings, { ...b, id: uid(), status: "pending" }] })),
      setBookingStatus: (id, status, ownerNote) =>
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === id
              ? { ...b, status, ownerNote: ownerNote?.trim() ? ownerNote.trim() : b.ownerNote }
              : b,
          ),
        })),

      submitPaymentReceipt: (id, receipt) =>
        set((s) => ({
          payments: s.payments.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status: "validating" as const,
                  receiptDataUrl: receipt.dataUrl,
                  receiptName: receipt.name,
                  receiptType: receipt.type,
                  receiptUploadedAt: new Date().toISOString().slice(0, 10),
                  // limpiar feedback previo si vuelve a subir tras rechazo
                  ownerNote: undefined,
                  reviewedAt: undefined,
                }
              : p,
          ),
        })),
      approvePayment: (id, ownerNote) =>
        set((s) => ({
          payments: s.payments.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status: "paid" as const,
                  paidAt: new Date().toISOString().slice(0, 10),
                  reviewedAt: new Date().toISOString().slice(0, 10),
                  ownerNote: ownerNote?.trim() ? ownerNote.trim() : p.ownerNote,
                }
              : p,
          ),
        })),
      rejectPayment: (id, ownerNote) =>
        set((s) => ({
          payments: s.payments.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status: "rejected" as const,
                  reviewedAt: new Date().toISOString().slice(0, 10),
                  ownerNote: ownerNote.trim(),
                }
              : p,
          ),
        })),
    }),
    {
      name: "estate-app",
      version: 6,
      // v5→v6: Amenity gana schedule/photo/capacity y AmenityBooking pasa a startTime/endTime.
      migrate: (persisted: unknown, version) => {
        if (version < 6) {
          const prev = (persisted ?? {}) as { currentUser?: User | null };
          return { currentUser: prev.currentUser ?? null };
        }
        return (persisted as { currentUser: User | null }) ?? { currentUser: null };
      },
      partialize: (s) => ({ currentUser: s.currentUser }),
    },
  ),
);

export const getRole = (u: User | null): Role => u?.role ?? "public";

/** Helpers de dominio (derivar fuera de selectores para no provocar re-renders). */
export const getUnitAddress = (unit: Unit, building: Building | undefined): string =>
  unit.addressOverride ?? building?.address ?? "";

export const getUnitCity = (unit: Unit, building: Building | undefined): string =>
  unit.cityOverride ?? building?.city ?? "";
