const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");
const Pino = require("pino");
const axios = require("axios");
const stringSimilarity = require("string-similarity");

const API_URL = "https://script.google.com/macros/s/AKfycbzamXOQ2kRiBvFuGSFryJOmQfojkblSN1GR2_shc690IfPdoSPeo1WP3AkIBLAh7Ag50Q/exec";
const GOOGLE_API_KEY = 'AIzaSyBvVjaJMXlUU8sezFQwoIFUH-2fxh2dtSk';
const GOOGLE_CSE_ID = 'a645b5428535746ae';
const GOOGLE_SEARCH_URL = 'https://www.googleapis.com/customsearch/v1';

async function searchInternet(query) {
    try { 
        const response = await axios.get(GOOGLE_SEARCH_URL, {
            params: {
                key: GOOGLE_API_KEY,
                cx: GOOGLE_CSE_ID,
                q: query,
            },
        });
        const results = response.data.items;
        if (results && results.length > 0) {
            return results.map(result => `${result.title}: ${result.link}`).join("\n");
        } else {
            return "Tidak ada hasil ditemukan.";
        }
    } catch (error) {
        console.error("Error searching the internet:", error);
        return "Terjadi kesalahan saat mencari di internet.";
    }
}

async function connectToWhatsapp() {
    const auth = await useMultiFileAuthState("AuthCS");
    const sock = makeWASocket({
        printQRInTerminal: true,
        browser: ["ChatBot", "Google Chrome", "126.0.28.127"],
        auth: auth.state,
        logger: Pino({ level: "silent" })
    });

    sock.ev.on('creds.update', auth.saveCreds);
    sock.ev.on('connection.update', ({ connection }) => {
        if (connection === 'open') console.log('Terhubung');
        if (connection === 'close') {
            console.log('Koneksi Terputus. \nMenghubungkan Ulang...');
            connectToWhatsapp();
        }
    });

    async function fetchResponses() {
        try {
            const response = await axios.get(API_URL);
            return response.data;
        } catch (error) {
            console.error("Gagal mengambil data:", error);
            return {};
        }
    }

    async function findClosestResponse(input, responses) {
        const keywords = Object.keys(responses);
        const matches = stringSimilarity.findBestMatch(input, keywords);
        
        const bestMatchRating = matches.bestMatch.rating;
        console.log(`Kemiripan : ${bestMatchRating}`);
    
        if (bestMatchRating >= 0.6) {
            return responses[matches.bestMatch.target];
        }
    }

    const searchKeywords = ["cari", "carikan", "bagaimana", "lalu bagaimana", "bantu cari", "siapakah", "dimana", "kapan", "lantas", "kenapa", "mengapa", "berapa", "jelaskan"];

    sock.ev.on('messages.upsert', async m => {
        try {
            const msg = m.messages[0];
            const senderJid = msg.key.remoteJid;
            let text = '';

            if (msg.message && msg.message.conversation) {
                text = msg.message.conversation.trim().toLowerCase();
            } else if (msg.message && msg.message.extendedTextMessage) {
                text = msg.message.extendedTextMessage.text.trim().toLowerCase();
            }

            console.log("Pengirim :", senderJid);
            console.log("Pesan :", text);
            
            if (!msg.key.fromMe && m.type === 'notify') {
                const isSearchCommand = searchKeywords.some(keyword => text.startsWith(keyword));
                
                if (isSearchCommand && (senderJid.includes('120363334350141200@g.us')|| senderJid.includes('1568820937@g.us'))) {
                    const query = text.split(" ").slice(1).join(" ");
                    const searchResult = await searchInternet(query);
                    await sock.sendMessage(senderJid, { text: searchResult }, { quoted: msg });
                } else if (senderJid.includes('120363334350141200@g.us')|| senderJid.includes('1568820937@g.us')) {
                    const responses = await fetchResponses();
                    const responseText = await findClosestResponse(text, responses);
                    
                    if (responseText) {
                        await sock.sendMessage(senderJid, { text: responseText },{quoted:msg});
                    } else {
                        console.log("kata tidak dipahami");
                    }
                } else {
                    console.log("tidak ada data yang sama");
                }
            }
        } catch (error) {
            console.error("Terjadi kesalahan dalam pemahaman.", error);
        }
    });
}

connectToWhatsapp();
