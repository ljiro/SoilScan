const API_KEY = '0d91ca73969bff5819087d590129f843';
const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

export const getWeatherData = async (latitude, longitude) => {
  // Skip API call if no key configured
  if (API_KEY === 'YOUR_OPENWEATHERMAP_API_KEY') {
    return {
      temperature: null,
      humidity: null,
      condition: null,
      source: 'not_configured',
    };
  }

  try {
    const response = await fetch(
      `${BASE_URL}?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric`
    );

    if (!response.ok) {
      throw new Error('Weather API error');
    }

    const data = await response.json();

    return {
      temperature: data.main?.temp,
      humidity: data.main?.humidity,
      condition: data.weather?.[0]?.main,
      source: 'api',
    };
  } catch (error) {
    console.error('Weather API Error:', error);
    return {
      temperature: null,
      humidity: null,
      condition: null,
      source: 'unavailable',
    };
  }
};
