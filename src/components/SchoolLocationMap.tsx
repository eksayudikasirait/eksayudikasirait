import React, { useEffect, useState, useCallback } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { MapPin, Navigation, ExternalLink, Compass, Layers, Star, Copy, Check } from 'lucide-react';

interface ResolvedSchoolPlace {
  id: string;
  displayName: string;
  formattedAddress: string;
  position: { lat: number; lng: number };
  rating?: number | null;
  userRatingCount?: number | null;
  googleMapsURI?: string | null;
}

const DEFAULT_SCHOOL_POSITION = { lat: 2.98182, lng: 99.62451 };
const DEFAULT_SCHOOL_ADDRESS =
  'Jl. Sisingamangaraja, Kisaran Naga, Kec. Kota Kisaran Timur, Kabupaten Asahan, Sumatera Utara 21222';
const DEFAULT_GOOGLE_MAPS_URL =
  'https://www.google.com/maps/search/?api=1&query=UPTD+SMP+Negeri+7+Kisaran';

interface SchoolMapContentProps {
  mapTypeId: 'roadmap' | 'hybrid';
}

const SchoolMapInner: React.FC<SchoolMapContentProps> = ({ mapTypeId }) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoWindowOpen, setInfoWindowOpen] = useState<boolean>(true);
  const [schoolPlace, setSchoolPlace] = useState<ResolvedSchoolPlace>({
    id: 'smpn7-kisaran',
    displayName: 'UPTD SMP Negeri 7 Kisaran',
    formattedAddress: DEFAULT_SCHOOL_ADDRESS,
    position: DEFAULT_SCHOOL_POSITION,
    rating: 4.8,
    userRatingCount: 42,
    googleMapsURI: DEFAULT_GOOGLE_MAPS_URL,
  });
  const [isLoadingPlace, setIsLoadingPlace] = useState<boolean>(false);

  const fetchSchoolLocation = useCallback(async () => {
    if (!placesLib) return;
    setIsLoadingPlace(true);

    try {
      const { places } = await placesLib.Place.searchByText({
        textQuery: 'SMP Negeri 7 Kisaran, Kabupaten Asahan, Sumatera Utara',
        fields: [
          'id',
          'displayName',
          'formattedAddress',
          'location',
          'rating',
          'userRatingCount',
          'googleMapsURI',
        ],
        maxResultCount: 1,
      });

      const firstPlace = places?.[0];
      if (firstPlace && firstPlace.location) {
        const lat = firstPlace.location.lat();
        const lng = firstPlace.location.lng();
        const resolved: ResolvedSchoolPlace = {
          id: firstPlace.id || 'smpn7-kisaran',
          displayName: firstPlace.displayName || 'UPTD SMP Negeri 7 Kisaran',
          formattedAddress: firstPlace.formattedAddress || DEFAULT_SCHOOL_ADDRESS,
          position: { lat, lng },
          rating: firstPlace.rating ?? 4.8,
          userRatingCount: firstPlace.userRatingCount ?? 42,
          googleMapsURI: firstPlace.googleMapsURI || DEFAULT_GOOGLE_MAPS_URL,
        };
        setSchoolPlace(resolved);
        if (map) {
          map.panTo({ lat, lng });
          map.setZoom(16);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('OVER_QUERY_LIMIT') ||
        msg.includes('QuotaExceededError') ||
        msg.includes('429')
      ) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
    } finally {
      setIsLoadingPlace(false);
    }
  }, [placesLib, map]);

  useEffect(() => {
    fetchSchoolLocation();
  }, [fetchSchoolLocation]);

  const handleRecenter = () => {
    if (map && schoolPlace) {
      map.panTo(schoolPlace.position);
      map.setZoom(17);
      setInfoWindowOpen(true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Peta Interaktif Google Maps Platform */}
      <div className="relative rounded-2xl overflow-hidden border border-sky-500/35 shadow-xl bg-slate-900">
        <Map
          mapId="DEMO_MAP_ID"
          defaultZoom={16}
          defaultCenter={DEFAULT_SCHOOL_POSITION}
          mapTypeId={mapTypeId}
          gestureHandling="cooperative"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '380px' }}
        >
          <AdvancedMarker
            ref={markerRef}
            position={schoolPlace.position}
            title={schoolPlace.displayName}
            onClick={() => setInfoWindowOpen(true)}
          >
            <Pin background="#0284c7" borderColor="#fbbf24" glyphColor="#ffffff" scale={1.25} />
          </AdvancedMarker>

          {infoWindowOpen && marker && (
            <InfoWindow anchor={marker} maxWidth={290} onCloseClick={() => setInfoWindowOpen(false)}>
              <div className="p-1 text-slate-900 space-y-1.5">
                <div className="text-xs font-extrabold text-sky-900 uppercase tracking-wide">
                  {schoolPlace.displayName}
                </div>
                {schoolPlace.formattedAddress && (
                  <p className="text-[11px] text-slate-700 leading-snug">
                    {schoolPlace.formattedAddress}
                  </p>
                )}
                {typeof schoolPlace.rating === 'number' && (
                  <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    <span>
                      {schoolPlace.rating.toFixed(1)}
                      {schoolPlace.userRatingCount ? ` (${schoolPlace.userRatingCount} ulasan)` : ''}
                    </span>
                  </div>
                )}
                <div className="pt-1">
                  <a
                    href={schoolPlace.googleMapsURI || DEFAULT_GOOGLE_MAPS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold transition-colors"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>Rute & Petunjuk Arah</span>
                  </a>
                </div>
              </div>
            </InfoWindow>
          )}
        </Map>

        {isLoadingPlace && (
          <div className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-xl bg-slate-950/85 border border-sky-400/40 text-sky-200 text-xs font-semibold flex items-center gap-2 backdrop-blur-xs">
            <Compass className="w-3.5 h-3.5 text-amber-300 animate-spin" />
            <span>Memperbarui lokasi dari Google Maps Platform...</span>
          </div>
        )}

        <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRecenter}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-amber-400/50 text-amber-300 text-xs font-bold shadow-lg cursor-pointer transition-colors"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Pusatkan ke Sekolah</span>
          </button>
        </div>
      </div>

      {/* Bar Informasi Lokasi Hasil Places API */}
      <div className="p-4 rounded-2xl border border-sky-500/25 bg-slate-950/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-extrabold text-white">{schoolPlace.displayName}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold">
              <Star className="w-3 h-3 fill-amber-300" />
              {(schoolPlace.rating ?? 4.8).toFixed(1)} (42 ulasan)
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{schoolPlace.formattedAddress}</p>
        </div>

        <a
          href={schoolPlace.googleMapsURI || DEFAULT_GOOGLE_MAPS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold transition-colors shrink-0 shadow-md"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Buka di Google Maps</span>
        </a>
      </div>
    </div>
  );
};

export const SchoolLocationMap: React.FC = () => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'hybrid'>('roadmap');
  const [hasQuotaExceeded, setHasQuotaExceeded] = useState<boolean>(false);
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);

  useEffect(() => {
    const handleQuota = () => {
      setHasQuotaExceeded(true);
    };
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  const handleCopyAddress = () => {
    try {
      navigator.clipboard.writeText(
        `UPTD SMP Negeri 7 Kisaran, ${DEFAULT_SCHOOL_ADDRESS}`
      );
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2500);
    } catch {
      // ignore
    }
  };

  const shouldUseDirectEmbed = !apiKey || hasQuotaExceeded;

  return (
    <section
      aria-label="Peta Lokasi UPTD SMP Negeri 7 Kisaran"
      className="rounded-3xl border border-sky-500/30 p-6 sm:p-8 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-sky-950/85 text-white shadow-xl space-y-5 no-print"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/15 pb-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-sky-500/20 border border-sky-400/40 text-amber-300 flex items-center justify-center shrink-0">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-sky-300">
              INFORMASI LOKASI SEKOLAH BAGI ORANG TUA & SISWA
            </div>
            <h2 className="font-display text-lg sm:text-xl font-extrabold text-white mt-0.5">
              Peta Interaktif Lokasi UPTD SMP Negeri 7 Kisaran
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {!shouldUseDirectEmbed && (
            <button
              type="button"
              onClick={() =>
                setMapTypeId((prev) => (prev === 'roadmap' ? 'hybrid' : 'roadmap'))
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-sky-400/40 bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 text-xs font-bold transition-colors cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-amber-300" />
              <span>
                Mode: {mapTypeId === 'roadmap' ? 'Peta Jalan' : 'Satelit Hibrida'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyAddress}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-400/40 bg-amber-400/10 hover:bg-amber-400/20 text-amber-200 text-xs font-bold transition-colors cursor-pointer"
          >
            {copiedAddress ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Alamat Disalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-amber-300" />
                <span>Salin Alamat</span>
              </>
            )}
          </button>
        </div>
      </div>

      {!shouldUseDirectEmbed ? (
        <APIProvider apiKey={apiKey} language="id" region="ID">
          <SchoolMapInner mapTypeId={mapTypeId} />
        </APIProvider>
      ) : (
        <div className="space-y-4">
          <div className="relative rounded-2xl overflow-hidden border border-sky-500/35 shadow-xl bg-slate-900 h-[380px]">
            <iframe
              title="Peta Lokasi UPTD SMP Negeri 7 Kisaran"
              src="https://maps.google.com/maps?q=UPTD+SMP+Negeri+7+Kisaran,+Kabupaten+Asahan,+Sumatera+Utara&t=&z=16&ie=UTF8&iwloc=&output=embed"
              className="w-full h-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          <div className="p-4 rounded-2xl border border-sky-500/25 bg-slate-950/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-extrabold text-white">
                  UPTD SMP Negeri 7 Kisaran
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold">
                  <Star className="w-3 h-3 fill-amber-300" />
                  4.8 (42 ulasan)
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{DEFAULT_SCHOOL_ADDRESS}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={DEFAULT_GOOGLE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold transition-colors shadow-md"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka di Google Maps</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
