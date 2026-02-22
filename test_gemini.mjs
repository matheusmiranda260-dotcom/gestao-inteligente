const API_KEY = "AIzaSyCSljOvDE1OTke6L-HO9VeHZALRMSOZDso";

async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();
        console.log(data.models.map(m => m.name));
    } catch (e) {
        console.error(e);
    }
}

listModels();
