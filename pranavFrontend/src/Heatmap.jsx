import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import API from "./api";

const getColor = (count) => {
  if (!count || count === 0) return "#f1f5f9"; // None
  if (count <= 15) return "#dcfce7"; // Low
  if (count <= 35) return "#fef9c3"; // Medium
  return "#fdba74"; // High
};

const Heatmap = ({ height = "400px" }) => {
  const [mergedData, setMergedData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [geoRes, statsRes] = await Promise.all([
          fetch("/mygeodata/mygeodata.geojson").then((res) => res.json()),
          API.get("/complaints/map/wards")
        ]);

        const statsMap = {};
        if (statsRes.data.success) {
          statsRes.data.data.forEach((s) => {
            statsMap[s.ward] = s;
          });
        }

        const merged = {
          ...geoRes,
          features: geoRes.features.map((feature) => {
            const wardName = feature.properties.ward_lgd_name;
            const stats = statsMap[wardName] || { count: 0, resolved: 0 };
            return {
              ...feature,
              properties: {
                ...feature.properties,
                complaintCount: stats.count,
                resolvedCount: stats.resolved
              }
            };
          })
        };

        setMergedData(merged);
      } catch (err) {
        console.error("Heatmap load error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const styleFeature = (feature) => ({
    fillColor: getColor(feature.properties.complaintCount),
    fillOpacity: 0.5,
    color: "#455a64",
    weight: 1,
    opacity: 0.8
  });

  const onEachFeature = (feature, layer) => {
    const { ward_lgd_name, complaintCount, resolvedCount } = feature.properties;

    const resolutionRate = complaintCount > 0 ? Math.round((resolvedCount / complaintCount) * 100) : 0;

    layer.bindTooltip(
      `<div style="font-family: 'DM Sans', sans-serif; padding: 4px;">
        <b style="font-size: 14px; color: #1e293b;">Ward: ${ward_lgd_name}</b><br/>
        <div style="margin-top: 6px; font-size: 12px;">
          <span style="color: #64748b;">Total:</span> <b style="color: #0f172a;">${complaintCount || 0}</b><br/>
          <span style="color: #64748b;">Resolved:</span> <b style="color: #16a34a;">${resolvedCount || 0}</b> (${resolutionRate}%)
        </div>
      </div>`,
      { sticky: true, className: 'custom-tooltip' }
    );

    layer.on({
      mouseover: (e) => e.target.setStyle({ fillOpacity: 0.7, weight: 2 }),
      mouseout: (e) => e.target.setStyle(styleFeature(feature))
    });
  };

  if (loading) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '16px' }}>Loading Heatmap...</div>;

  return (
    <div style={{ height, width: "100%", borderRadius: "16px", overflow: "hidden", position: "relative" }}>
      <MapContainer
        center={[23.2599, 77.4126]}
        zoom={12}
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {mergedData && (
          <GeoJSON
            data={mergedData}
            style={styleFeature}
            onEachFeature={onEachFeature}
            key={JSON.stringify(mergedData.features.length)}
          />
        )}
      </MapContainer>
      
      {/* Mini Legend */}
      <div style={{
        position: "absolute", bottom: 15, right: 15, zIndex: 1000,
        background: "rgba(255, 255, 255, 0.95)", padding: "12px",
        borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        fontSize: "11px", border: "1px solid #e2e8f0",
        backdropFilter: "blur(4px)"
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Complaint Density</div>
        {[
          { color: "#f1f5f9", label: "None (0)" },
          { color: "#dcfce7", label: "Low (1-15)" },
          { color: "#fef9c3", label: "Med (16-35)" },
          { color: "#fdba74", label: "High (36+)" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
            <div style={{ width: 14, height: 14, background: color, border: "1px solid #cbd5e1", borderRadius: "3px" }} />
            <span style={{ color: '#475569', fontWeight: 500 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Heatmap;
