import React, { useEffect, useState } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  APILoadingStatus,
} from '@vis.gl/react-google-maps';
import { MapPin, AlertTriangle, Navigation } from 'lucide-react';
import { SalesVisitRecord, TrainerVisitRecord } from '../types/dashboard';
import { DEFAULT_PEKANBARU_CENTER } from '../services/salesVisitService';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio'];

export const SalesVisitMapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <APIProvider apiKey={MAPS_API_KEY} libraries={['marker']} language="id" region="ID">
      {children}
    </APIProvider>
  );
};

function getPersonPinColors(personName: string): {
  background: string;
  borderColor: string;
  glyphColor: string;
} {
  if (personName === 'ILHAMSYAH') {
    return {
      background: '#059669',
      borderColor: '#065f46',
      glyphColor: '#ffffff',
    };
  }
  if (personName === 'TIWI') {
    return {
      background: '#e11d48',
      borderColor: '#9f1239',
      glyphColor: '#ffffff',
    };
  }
  if (personName === 'ALBERT') {
    return {
      background: '#4f46e5',
      borderColor: '#3730a3',
      glyphColor: '#ffffff',
    };
  }
  if (personName === 'ARA') {
    return {
      background: '#9333ea',
      borderColor: '#6b21a8',
      glyphColor: '#ffffff',
    };
  }
  if (personName === 'RATIH') {
    return {
      background: '#0284c7',
      borderColor: '#075985',
      glyphColor: '#ffffff',
    };
  }
  return {
    background: '#0d9488',
    borderColor: '#115e59',
    glyphColor: '#ffffff',
  };
}

interface PickerMapProps {
  lat: number | null;
  lng: number | null;
  locationLabel: string;
  storeName: string;
  salesName: string;
  roleLabel?: string;
  onSelectCoordinates: (lat: number, lng: number) => void;
  heightClass?: string;
}

export const SalesVisitLocationPickerMap: React.FC<PickerMapProps> = ({
  lat,
  lng,
  locationLabel,
  storeName,
  salesName,
  roleLabel = 'Sales',
  onSelectCoordinates,
  heightClass = 'h-[280px] sm:h-[310px]',
}) => {
  const status = useApiLoadingStatus();
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(false);

  const hasCoords =
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  const [controlledCenter, setControlledCenter] = useState<{ lat: number; lng: number }>(
    hasCoords
      ? { lat: lat as number, lng: lng as number }
      : DEFAULT_PEKANBARU_CENTER
  );

  useEffect(() => {
    if (hasCoords) {
      setControlledCenter({ lat: lat as number, lng: lng as number });
    }
  }, [hasCoords, lat, lng]);

  if (
    !MAPS_API_KEY ||
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE
  ) {
    return (
      <div
        className={`${heightClass} w-full rounded-xl border border-amber-200 bg-amber-50/70 flex flex-col items-center justify-center p-5 text-center`}
      >
        <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 mb-2">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <p className="text-xs font-extrabold text-amber-950">
          {!MAPS_API_KEY
            ? 'API Key Google Maps belum tersedia di environment runtime'
            : 'Peta Google Maps gagal dimuat'}
        </p>
        <p className="text-[11px] text-amber-800 mt-1 max-w-md">
          Anda tetap dapat mengunci koordinat lokasi terkini melalui tombol{' '}
          <span className="font-bold">Ambil Lokasi GPS</span> atau pilihan area cepat / input koordinat.
        </p>
        {hasCoords && (
          <div className="mt-3 px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-xs font-mono font-bold text-slate-800 tabular-nums">
            Koordinat Terkunci: {(lat as number).toFixed(6)}, {(lng as number).toFixed(6)}
          </div>
        )}
      </div>
    );
  }

  const colors = getPersonPinColors(salesName || 'ILHAMSYAH');

  return (
    <div className={`${heightClass} w-full rounded-xl overflow-hidden border border-slate-200 relative shadow-xs`}>
      <GoogleMap
        mapId="DEMO_MAP_ID"
        internalUsageAttributionIds={ATTRIBUTION_IDS}
        center={controlledCenter}
        onCenterChanged={(ev) => {
          const c = ev.detail?.center;
          if (c) setControlledCenter({ lat: c.lat, lng: c.lng });
        }}
        defaultZoom={14}
        gestureHandling="greedy"
        disableDefaultUI={false}
        style={{ width: '100%', height: '100%' }}
        onClick={(ev) => {
          const clickedLatLng = ev.detail?.latLng;
          if (clickedLatLng) {
            onSelectCoordinates(clickedLatLng.lat, clickedLatLng.lng);
            setInfoOpen(true);
          }
        }}
      >
        {hasCoords && (
          <>
            <AdvancedMarker
              ref={markerRef}
              position={{ lat: lat as number, lng: lng as number }}
              draggable
              title={storeName || `Lokasi Kunjungan ${roleLabel}`}
              onClick={() => setInfoOpen((prev) => !prev)}
              onDragEnd={(ev) => {
                const pos = ev.latLng;
                if (pos) {
                  const nextLat = typeof pos.lat === 'function' ? pos.lat() : Number(pos.lat);
                  const nextLng = typeof pos.lng === 'function' ? pos.lng() : Number(pos.lng);
                  if (Number.isFinite(nextLat) && Number.isFinite(nextLng)) {
                    onSelectCoordinates(nextLat, nextLng);
                    setInfoOpen(true);
                  }
                }
              }}
            >
              <Pin
                background={colors.background}
                borderColor={colors.borderColor}
                glyphColor={colors.glyphColor}
              />
            </AdvancedMarker>
            {infoOpen && (
              <InfoWindow anchor={marker} onCloseClick={() => setInfoOpen(false)}>
                <div className="p-1 max-w-[220px] text-slate-800">
                  <div className="text-xs font-extrabold text-slate-900">
                    {storeName || 'Titik Lokasi Kunjungan'}
                  </div>
                  {salesName && (
                    <div className="text-[11px] font-semibold text-teal-700 mt-0.5">
                      {roleLabel}: {salesName}
                    </div>
                  )}
                  {locationLabel && (
                    <div className="text-[11px] text-slate-600 mt-1">{locationLabel}</div>
                  )}
                  <div className="text-[10px] font-mono text-slate-500 mt-1 tabular-nums">
                    {(lat as number).toFixed(6)}, {(lng as number).toFixed(6)}
                  </div>
                </div>
              </InfoWindow>
            )}
          </>
        )}
      </GoogleMap>
      <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:right-auto bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm flex items-center gap-2 text-[11px] text-slate-700 pointer-events-none">
        <Navigation className="w-3.5 h-3.5 text-teal-600 shrink-0" />
        <span>
          {hasCoords
            ? 'Klik peta atau geser pin untuk menyesuaikan titik lokasi tepat.'
            : 'Klik peta atau tekan Ambil Lokasi GPS untuk menandai lokasi.'}
        </span>
      </div>
    </div>
  );
};

interface GenericOverviewPinRecord {
  id: string;
  storeName: string;
  personName: string;
  selfieDataUrl: string;
  visitTime: string;
  latitude: number;
  longitude: number;
  locationLabel: string;
  notes: string;
}

interface OverviewPinItemProps {
  visit: GenericOverviewPinRecord;
  isSelected: boolean;
  onSelectById: (id: string | null) => void;
}

const OverviewPinItem: React.FC<OverviewPinItemProps> = ({
  visit,
  isSelected,
  onSelectById,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const colors = getPersonPinColors(visit.personName);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: visit.latitude, lng: visit.longitude }}
        title={`${visit.storeName} (${visit.personName})`}
        onClick={() => onSelectById(isSelected ? null : visit.id)}
      >
        <Pin
          background={colors.background}
          borderColor={colors.borderColor}
          glyphColor={colors.glyphColor}
        />
      </AdvancedMarker>
      {isSelected && (
        <InfoWindow anchor={marker} onCloseClick={() => onSelectById(null)}>
          <div className="p-1 max-w-[240px] space-y-1.5 text-slate-800">
            {visit.selfieDataUrl && (
              <img
                src={visit.selfieDataUrl}
                alt={`Selfie ${visit.personName}`}
                className="w-full h-24 object-cover rounded-lg border border-slate-200"
              />
            )}
            <div className="text-xs font-extrabold text-slate-900">{visit.storeName}</div>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-bold text-teal-700">{visit.personName}</span>
              <span className="font-mono text-slate-500 tabular-nums">{visit.visitTime}</span>
            </div>
            <div className="text-[11px] text-slate-600">{visit.locationLabel}</div>
            <div className="text-[11px] text-slate-700 bg-slate-50 rounded p-1.5 border border-slate-200">
              {visit.notes}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

interface GenericOverviewMapProps {
  items: GenericOverviewPinRecord[];
  focusedId: string | null;
  onSelectId: (id: string | null) => void;
  heightClass?: string;
}

const GenericOverviewMap: React.FC<GenericOverviewMapProps> = ({
  items,
  focusedId,
  onSelectId,
  heightClass = 'h-[320px] sm:h-[360px]',
}) => {
  const status = useApiLoadingStatus();
  const focusedItem = items.find((i) => i.id === focusedId) || null;
  const latestVisit = focusedItem || items[0] || null;
  const [center, setCenter] = useState<{ lat: number; lng: number }>(
    latestVisit
      ? { lat: latestVisit.latitude, lng: latestVisit.longitude }
      : DEFAULT_PEKANBARU_CENTER
  );

  useEffect(() => {
    if (focusedItem) {
      setCenter({ lat: focusedItem.latitude, lng: focusedItem.longitude });
    } else if (items.length > 0) {
      setCenter({ lat: items[0].latitude, lng: items[0].longitude });
    }
  }, [focusedItem, items]);

  if (
    !MAPS_API_KEY ||
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE
  ) {
    return (
      <div
        className={`${heightClass} w-full rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-5 text-center`}
      >
        <MapPin className="w-6 h-6 text-slate-400 mb-2" />
        <p className="text-xs font-bold text-slate-700">
          Peta Sebaran Kunjungan Google Maps belum aktif
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          Tercatat {items.length} titik koordinat kunjungan tersimpan di tabel riwayat di bawah.
        </p>
      </div>
    );
  }

  return (
    <div className={`${heightClass} w-full rounded-xl overflow-hidden border border-slate-200 relative shadow-xs`}>
      <GoogleMap
        mapId="DEMO_MAP_ID"
        internalUsageAttributionIds={ATTRIBUTION_IDS}
        center={center}
        onCenterChanged={(ev) => {
          const c = ev.detail?.center;
          if (c) setCenter({ lat: c.lat, lng: c.lng });
        }}
        defaultZoom={12}
        gestureHandling="greedy"
        style={{ width: '100%', height: '100%' }}
      >
        {items.map((v) => (
          <OverviewPinItem
            key={v.id}
            visit={v}
            isSelected={focusedId === v.id}
            onSelectById={onSelectId}
          />
        ))}
      </GoogleMap>
    </div>
  );
};

interface SalesOverviewMapProps {
  visits: SalesVisitRecord[];
  focusedVisit: SalesVisitRecord | null;
  onFocusVisit: (visit: SalesVisitRecord | null) => void;
  heightClass?: string;
}

export const SalesVisitOverviewMap: React.FC<SalesOverviewMapProps> = ({
  visits,
  focusedVisit,
  onFocusVisit,
  heightClass,
}) => {
  const mapped: GenericOverviewPinRecord[] = visits.map((v) => ({
    id: v.id,
    storeName: v.storeName,
    personName: v.salesName,
    selfieDataUrl: v.selfieDataUrl,
    visitTime: v.visitTime,
    latitude: v.latitude,
    longitude: v.longitude,
    locationLabel: v.locationLabel,
    notes: v.notes,
  }));

  return (
    <GenericOverviewMap
      items={mapped}
      focusedId={focusedVisit?.id || null}
      onSelectId={(id) => onFocusVisit(id ? visits.find((v) => v.id === id) || null : null)}
      heightClass={heightClass}
    />
  );
};

interface TrainerOverviewMapProps {
  visits: TrainerVisitRecord[];
  focusedVisit: TrainerVisitRecord | null;
  onFocusVisit: (visit: TrainerVisitRecord | null) => void;
  heightClass?: string;
}

export const TrainerVisitOverviewMap: React.FC<TrainerOverviewMapProps> = ({
  visits,
  focusedVisit,
  onFocusVisit,
  heightClass,
}) => {
  const mapped: GenericOverviewPinRecord[] = visits.map((v) => ({
    id: v.id,
    storeName: v.storeName,
    personName: v.trainerName,
    selfieDataUrl: v.selfieDataUrl,
    visitTime: v.visitTime,
    latitude: v.latitude,
    longitude: v.longitude,
    locationLabel: v.locationLabel,
    notes: v.notes,
  }));

  return (
    <GenericOverviewMap
      items={mapped}
      focusedId={focusedVisit?.id || null}
      onSelectId={(id) => onFocusVisit(id ? visits.find((v) => v.id === id) || null : null)}
      heightClass={heightClass}
    />
  );
};
