// ✅ CORREÇÃO: Definir corsHeaders diretamente no arquivo
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Coordenadas fixas da origem
const ORIGIN_COORDS = { lat: -22.3601, lon: -48.9715 }; // Pederneiras, SP

async function getCoords(city, state) {
  const query = encodeURIComponent(`${city}, ${state}, Brazil`);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}`;
  
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Base44FreightApp/1.0' } });
    if (!response.ok) {
        throw new Error(`Nominatim API responded with status: ${response.status}`);
    }
    const data = await response.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error(`Geocoding error for ${city}, ${state}:`, e);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { destinationCity, destinationState } = await req.json();
    if (!destinationCity || !destinationState) {
      return new Response(JSON.stringify({ error: 'Cidade e estado de destino são obrigatórios.' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const destCoords = await getCoords(destinationCity, destinationState);
    if (!destCoords) {
      return new Response(JSON.stringify({ error: `Não foi possível encontrar as coordenadas para ${destinationCity}, ${destinationState}.` }), { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const orsApiKey = Deno.env.get("OPENROUTESERVICE_API_KEY");
    const tollguruApiKey = Deno.env.get("TOLLGURU_API_KEY");
    
    if (!orsApiKey) {
      throw new Error("API Key do OpenRouteService não encontrada");
    }
    
    if (!tollguruApiKey) {
      console.warn("⚠️ API Key do TollGuru não encontrada - continuando sem dados de pedágio");
    }

    // ✅ PASSO 1: Obter rota do OpenRouteService
    const orsUrl = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
    const requestBody = {
      "coordinates": [
        [ORIGIN_COORDS.lon, ORIGIN_COORDS.lat],
        [destCoords.lon, destCoords.lat]
      ],
      "preference": "recommended"
    };

    console.log('📍 Enviando requisição para ORS:', JSON.stringify(requestBody));

    const orsResponse = await fetch(orsUrl, {
      method: 'POST',
      headers: {
        'Authorization': orsApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!orsResponse.ok) {
      const errorBody = await orsResponse.json();
      console.error("❌ Erro da API OpenRouteService:", errorBody);
      throw new Error(`API de roteamento falhou: ${errorBody.error?.message || 'Erro desconhecido'}`);
    }

    const routeData = await orsResponse.json();
    const route = routeData.features[0];
    const distanceKm = (route.properties.summary.distance / 1000).toFixed(2);
    const durationMinutes = (route.properties.summary.duration / 60).toFixed(2);
    const routeCoordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);

    console.log('✅ Rota ORS obtida com sucesso');

    // ✅ PASSO 2: Obter pedágios do TollGuru (se API key disponível)
    let tollData = null;

    if (tollguruApiKey) {
      try {
        const tollguruUrl = 'https://apis.tollguru.com/toll/v2/origin-destination-waypoints';
        const tollguruBody = {
          "from": {
            "lat": ORIGIN_COORDS.lat,
            "lng": ORIGIN_COORDS.lon
          },
          "to": {
            "lat": destCoords.lat,
            "lng": destCoords.lon
          },
          "serviceProvider": "here",
          "vehicle": {
            "type": "2AxlesTruck" // Tipo para caminhão
          }
        };

        console.log('💰 Enviando requisição para TollGuru:', JSON.stringify(tollguruBody));

        const tollguruResponse = await fetch(tollguruUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': tollguruApiKey
          },
          body: JSON.stringify(tollguruBody)
        });

        if (tollguruResponse.ok) {
          const tollguruData = await tollguruResponse.json();
          console.log('✅ Resposta TollGuru recebida:', JSON.stringify(tollguruData, null, 2));
          
          if (tollguruData.route && tollguruData.route.tolls) {
            tollData = {
              tolls: tollguruData.route.tolls.map(toll => ({
                name: toll.name || `Pedágio ${toll.id || 'Desconhecido'}`,
                lat: toll.lat,
                lng: toll.lng,
                cost: toll.tagCost || toll.cashCost || 0,
                currency: tollguruData.route.costs?.currency || 'USD',
                plaza: toll.plaza,
                road: toll.road,
                state: toll.state,
                country: toll.country
              })),
              totalCost: tollguruData.route.costs?.tag || tollguruData.route.costs?.cash || 0,
              currency: tollguruData.route.costs?.currency || 'USD',
              totalTolls: tollguruData.route.tolls.length
            };
            
            console.log(`💵 Custo total de pedágios: ${tollData.currency} ${tollData.totalCost}`);
          }
        } else {
          const errorBody = await tollguruResponse.json();
          console.warn('⚠️ TollGuru API falhou:', errorBody);
          console.warn('Continuando sem dados de pedágio...');
        }
      } catch (tollError) {
        console.warn('⚠️ Erro ao buscar pedágios:', tollError.message);
        console.warn('Continuando sem dados de pedágio...');
      }
    }

    // ✅ PASSO 3: Preparar resposta final
    const responseData = {
      origin: { coordinates: [ORIGIN_COORDS.lat, ORIGIN_COORDS.lon] },
      destination: { coordinates: [destCoords.lat, destCoords.lon] },
      route: {
        distance: parseFloat(distanceKm),
        duration: parseFloat(durationMinutes),
        geometry: routeCoordinates,
        tollData: tollData
      }
    };

    console.log(`📊 Enviando resposta com ${tollData?.tolls?.length || 0} pedágios`);
    console.log(`💰 Custo total: ${tollData?.currency || ''} ${tollData?.totalCost || 0}`);
    
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro geral no cálculo da rota:', error.message);
    return new Response(JSON.stringify({ error: 'Erro interno no servidor ao calcular a rota.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});