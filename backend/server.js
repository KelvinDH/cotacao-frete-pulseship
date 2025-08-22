const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

console.log('Variáveis de ambiente carregadas:');
console.log('API Key do OpenRouteService:', process.env.OPENROUTESERVICE_API_KEY ? 'Carregada com sucesso!' : 'NÃO FOI ENCONTRADA!');
console.log('- SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? 'EXISTE' : 'NÃO EXISTE');
console.log('- SENDGRID_FROM_EMAIL:', process.env.SENDGRID_FROM_EMAIL || 'NÃO EXISTE');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const app = express();
const PORT = 3001;

// ✅ CORREÇÃO: Aumenta o limite do corpo da requisição para evitar o erro "Payload Too Large".
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Middleware
app.use(cors({
    origin: ['http://localhost:3001', 'http://localhost:5173', 'http://192.168.1.14:5173'],
    credentials: true
}));

app.use('/uploads', express.static('uploads'));

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Conexão com o banco de dados SQLite
let db = null;

// ✅ CORREÇÃO: Função para obter a data/hora atual no fuso horário de Brasília
const getBrazilIsoNow = () => {
    const now = new Date();
    // Esta é uma forma de ajustar o fuso horário para 'America/Sao_Paulo'
    const brazilTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    return brazilTime.toISOString();
};

const initDatabase = () => {
    db = new sqlite3.Database('./freight_system.db', (err) => {
        if (err) {
            console.error('❌ Erro ao conectar com o banco de dados:', err.message);
        } else {
            console.log('✅ Conectado ao banco de dados SQLite');
            runCarrierMigration(() => {
                createTables();
            });
        }
    });
};

const runCarrierMigration = (callback) => {
    db.all("PRAGMA table_info(carriers)", (err, columns) => {
        if (err) {
            console.error("❌ Erro ao ler estrutura da tabela carriers:", err.message);
            if (callback) callback();
            return;
        }

        const hasTypeColumn = columns.some(col => col.name === 'type');
        const hasModalitiesColumn = columns.some(col => col.name === 'modalities');

        if (hasTypeColumn && !hasModalitiesColumn) {
            console.log("⚠️ Iniciando migração da tabela 'carriers'...");
            db.serialize(() => {
                db.run(`ALTER TABLE carriers ADD COLUMN modalities TEXT`, (err) => {
                    if (err) return console.error("❌ Erro ao adicionar coluna 'modalities':", err.message);
                    console.log("✅ Coluna 'modalities' adicionada.");
                });
                db.run(`UPDATE carriers SET modalities = '["' || type || '"]' WHERE type IS NOT NULL AND type != ''`, function(err) {
                    if (err) return console.error("❌ Erro ao migrar dados para 'modalities':", err.message);
                    console.log(`✅ ${this.changes} registros de transportadoras migrados para o novo formato.`);
                });
                db.run('ALTER TABLE carriers RENAME TO carriers_old');
                db.run(`
                    CREATE TABLE carriers (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        modalities TEXT NOT NULL,
                        active BOOLEAN DEFAULT 1,
                        created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_date DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                db.run('INSERT INTO carriers (id, name, modalities, active, created_date, updated_date) SELECT id, name, modalities, active, created_date, updated_date FROM carriers_old');
                db.run('DROP TABLE carriers_old', (err) => {
                    if (err) console.error("❌ Erro ao limpar tabela antiga:", err.message);
                    else console.log("✅ Migração da tabela 'carriers' concluída!");
                    if (callback) callback();
                });
            });
        } else {
            console.log("✅ Tabela 'carriers' já está atualizada. Nenhuma migração necessária.");
            if (callback) callback();
        }
    });
};

const createTables = () => {
    // ✅ ATUALIZADO: Tabela de usuários com campos para motoristas
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fullName TEXT NOT NULL,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            userType TEXT DEFAULT 'user',
            carrierName TEXT,
            cpf TEXT,
            phone TEXT,
            assignedMapNumber TEXT,
            active BOOLEAN DEFAULT 1,
            requirePasswordChange BOOLEAN DEFAULT 0,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('❌ Erro ao criar tabela users:', err);
        else {
            console.log('✅ Tabela users criada/verificada');
            createDefaultAdmin();
            checkAndAddDriverFields();
        }
    });

    // Tabela de tipos de caminhão
    db.run(`
        CREATE TABLE IF NOT EXISTS truck_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            capacity REAL NOT NULL,
            baseRate REAL NOT NULL,
            modality TEXT NOT NULL,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('❌ Erro ao criar tabela truck_types:', err);
        else console.log('✅ Tabela truck_types criada/verificada');
    });

    
    // Tabela de transportadoras
    db.run(`
        CREATE TABLE IF NOT EXISTS carriers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            modalities TEXT NOT NULL,
            active BOOLEAN DEFAULT 1,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('❌ Erro ao criar tabela carriers:', err);
        else console.log('✅ Tabela carriers criada/verificada');
    });

    // Tabela de estados
    db.run(`
        CREATE TABLE IF NOT EXISTS states (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            uf TEXT NOT NULL UNIQUE,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('❌ Erro ao criar tabela states:', err);
        else {
            console.log('✅ Tabela states criada/verificada');
            insertStatesData();
        }
    });

    // Tabela de cidades
    db.run(`
        CREATE TABLE IF NOT EXISTS cities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            state_id INTEGER NOT NULL,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (state_id) REFERENCES states (id)
        )
    `, (err) => {
        if (err) console.error('❌ Erro ao criar tabela cities:', err);
        else {
            console.log('✅ Tabela cities criada/verificada');
            syncCitiesData();
        }
    });

    // ✅ ATUALIZADO: Definição da tabela freight_maps com campos de rastreamento e ocorrências
    db.run(`
        CREATE TABLE IF NOT EXISTS freight_maps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mapNumber TEXT NOT NULL,
            mapImage TEXT,
            origin TEXT NOT NULL,
            destination TEXT NOT NULL,
            totalKm INTEGER NOT NULL,
            weight REAL NOT NULL,
            mapValue REAL NOT NULL,
            truckType TEXT NOT NULL,
            selectedCarrier TEXT,
            loadingMode TEXT NOT NULL,
            loadingDate TEXT NOT NULL,
            routeInfo TEXT,
            carrierProposals TEXT DEFAULT '{}',
            finalValue REAL,
            status TEXT DEFAULT 'negotiating',
            contractedAt TEXT,
            invoiceUrls TEXT DEFAULT '[]',
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT,
            managers TEXT,
            userCounterProposal REAL,
            selectedCarrierForCounter TEXT,
            justification TEXT,
            rejectedReason TEXT,
            finalizationObservation TEXT,
            routeData TEXT,
            editObservations TEXT DEFAULT '[]',
            assignedDriver TEXT,
            trackingStatus TEXT DEFAULT 'waiting',
            trackingHistory TEXT DEFAULT '[]',
            deliveredStops TEXT DEFAULT '[]',
            occurrences TEXT DEFAULT '[]',
            occurrenceImages TEXT DEFAULT '[]',
            failedStops TEXT DEFAULT '[]'
        )
    `, (err) => {
        if (err) console.error('❌ Erro ao criar tabela freight_maps:', err);
        else {
            console.log('✅ Tabela freight_maps criada/verificada');
            checkAndFixFreightMapsConstraint();
            runMigrations();
        }
    });
};

// ✅ NOVA FUNÇÃO: Adicionar campos de motorista se não existirem
const checkAndAddDriverFields = () => {
    db.all("PRAGMA table_info(users)", (err, columns) => {
        if (err) return console.error("❌ Erro ao verificar estrutura da tabela users:", err.message);
        
        const hasDriverFields = columns.some(col => col.name === 'cpf') && 
                               columns.some(col => col.name === 'phone') && 
                               columns.some(col => col.name === 'assignedMapNumber');
        
        if (!hasDriverFields) {
            console.log("⚠️ Adicionando campos de motorista à tabela users...");
            db.serialize(() => {
                if (!columns.some(col => col.name === 'cpf')) {
                    db.run('ALTER TABLE users ADD COLUMN cpf TEXT', (err) => {
                        if (err) console.error("❌ Erro ao adicionar coluna cpf:", err.message);
                        else console.log("✅ Coluna 'cpf' adicionada.");
                    });
                }
                if (!columns.some(col => col.name === 'phone')) {
                    db.run('ALTER TABLE users ADD COLUMN phone TEXT', (err) => {
                        if (err) console.error("❌ Erro ao adicionar coluna phone:", err.message);
                        else console.log("✅ Coluna 'phone' adicionada.");
                    });
                }
                if (!columns.some(col => col.name === 'assignedMapNumber')) {
                    db.run('ALTER TABLE users ADD COLUMN assignedMapNumber TEXT', (err) => {
                        if (err) console.error("❌ Erro ao adicionar coluna assignedMapNumber:", err.message);
                        else console.log("✅ Coluna 'assignedMapNumber' adicionada.");
                    });
                }
            });
        }
    });
};

// ... (O restante das funções de setup, como insertStatesData, syncCitiesData, etc., continuam iguais) ...
const insertStatesData = () => {
    db.get('SELECT COUNT(*) as count FROM states', (err, row) => {
        if (err) return console.error('❌ Erro ao verificar estados:', err);
        if (row.count === 0) {
            console.log('📍 Inserindo estados brasileiros...');
            const states = [
                { name: 'Acre', uf: 'AC' },
                { name: 'Alagoas', uf: 'AL' },
                { name: 'Amapá', uf: 'AP' },
                { name: 'Amazonas', uf: 'AM' },
                { name: 'Bahia', uf: 'BA' },
                { name: 'Ceará', uf: 'CE' },
                { name: 'Distrito Federal', uf: 'DF' },
                { name: 'Espírito Santo', uf: 'ES' },
                { name: 'Goiás', uf: 'GO' },
                { name: 'Maranhão', uf: 'MA' },
                { name: 'Mato Grosso', uf: 'MT' },
                { name: 'Mato Grosso do Sul', uf: 'MS' },
                { name: 'Minas Gerais', uf: 'MG' },
                { name: 'Pará', uf: 'PA' },
                { name: 'Paraíba', uf: 'PB' },
                { name: 'Paraná', uf: 'PR' },
                { name: 'Pernambuco', uf: 'PE' },
                { name: 'Piauí', uf: 'PI' },
                { name: 'Rio de Janeiro', uf: 'RJ' },
                { name: 'Rio Grande do Norte', uf: 'RN' },
                { name: 'Rio Grande do Sul', uf: 'RS' },
                { name: 'Rondônia', uf: 'RO' },
                { name: 'Roraima', uf: 'RR' },
                { name: 'Santa Catarina', uf: 'SC' },
                { name: 'São Paulo', uf: 'SP' },
                { name: 'Sergipe', uf: 'SE' },
                { name: 'Tocantins', uf: 'TO' }
            ];

            const stmt = db.prepare('INSERT INTO states (name, uf) VALUES (?, ?)');
            states.forEach(state => {
                stmt.run([state.name, state.uf]);
            });
            stmt.finalize();
            console.log('✅ Estados brasileiros inseridos com sucesso!');
        }
    });
};

const syncCitiesData = () => {
    console.log('🔄 Sincronizando tabela de cidades...');

    // A lista completa de cidades que devem existir no banco
    const targetCities = [
        // Acre
        {name: 'Rio Branco', uf: 'AC'}, {name: 'Cruzeiro do Sul', uf: 'AC'},
        // Alagoas
        {name: 'Maceió', uf: 'AL'}, {name: 'Arapiraca', uf: 'AL'},
        // Amapá
        {name: 'Macapá', uf: 'AP'}, {name: 'Santana', uf: 'AP'},
        // Amazonas
        {name: 'Manaus', uf: 'AM'}, {name: 'Parintins', uf: 'AM'},
        // Bahia
        {name: 'Salvador', uf: 'BA'}, {name: 'Feira de Santana', uf: 'BA'}, {name: 'Vitória da Conquista', uf: 'BA'}, {name: 'Camaçari', uf: 'BA'}, {name: 'Ilhéus', uf: 'BA'},
        // Ceará
        {name: 'Fortaleza', uf: 'CE'}, {name: 'Caucaia', uf: 'CE'}, {name: 'Juazeiro do Norte', uf: 'CE'}, {name: 'Sobral', uf: 'CE'},
        // Distrito Federal
        {name: 'Brasília', uf: 'DF'},
        // Espírito Santo
        {name: 'Vitória', uf: 'ES'}, {name: 'Serra', uf: 'ES'}, {name: 'Cariacica', uf: 'ES'}, {name: 'Cachoeiro de Itapemirim', uf: 'ES'},
        // Goiás
        {name: 'Goiânia', uf: 'GO'}, {name: 'Aparecida de Goiânia', uf: 'GO'}, {name: 'Anápolis', uf: 'GO'}, {name: 'Rio Verde', uf: 'GO'},
        // Maranhão
        {name: 'São Luís', uf: 'MA'}, {name: 'Imperatriz', uf: 'MA'}, {name: 'Caxias', uf: 'MA'},
        // Mato Grosso
        {name: 'Cuiabá', uf: 'MT'}, {name: 'Várzea Grande', uf: 'MT'}, {name: 'Rondonópolis', uf: 'MT'}, {name: 'Sinop', uf: 'MT'},
        // Mato Grosso do Sul
        {name: 'Campo Grande', uf: 'MS'}, {name: 'Dourados', uf: 'MS'}, {name: 'Três Lagoas', uf: 'MS'}, {name: 'Corumbá', uf: 'MS'},
        // Minas Gerais
        {name: 'Belo Horizonte', uf: 'MG'}, {name: 'Uberlândia', uf: 'MG'}, {name: 'Contagem', uf: 'MG'}, {name: 'Juiz de Fora', uf: 'MG'}, {name: 'Betim', uf: 'MG'}, {name: 'Montes Claros', uf: 'MG'}, {name: 'Ribeirão das Neves', uf: 'MG'}, {name: 'Uberaba', uf: 'MG'},
        // Pará
        {name: 'Belém', uf: 'PA'}, {name: 'Ananindeua', uf: 'PA'}, {name: 'Santarém', uf: 'PA'}, {name: 'Marabá', uf: 'PA'},
        // Paraíba
        {name: 'João Pessoa', uf: 'PB'}, {name: 'Campina Grande', uf: 'PB'}, {name: 'Santa Rita', uf: 'PB'},
        // Paraná
        {name: 'Curitiba', uf: 'PR'}, {name: 'Londrina', uf: 'PR'}, {name: 'Maringá', uf: 'PR'}, {name: 'Ponta Grossa', uf: 'PR'}, {name: 'Cascavel', uf: 'PR'}, {name: 'São José dos Pinhais', uf: 'PR'}, {name: 'Foz do Iguaçu', uf: 'PR'},
        // Pernambuco
        {name: 'Recife', uf: 'PE'}, {name: 'Jaboatão dos Guararapes', uf: 'PE'}, {name: 'Olinda', uf: 'PE'}, {name: 'Caruaru', uf: 'PE'}, {name: 'Petrolina', uf: 'PE'},
        // Piauí
        {name: 'Teresina', uf: 'PI'}, {name: 'Parnaíba', uf: 'PI'}, {name: 'Picos', uf: 'PI'},
        // Rio de Janeiro
        {name: 'Rio de Janeiro', uf: 'RJ'}, {name: 'São Gonçalo', uf: 'RJ'}, {name: 'Duque de Caxias', uf: 'RJ'}, {name: 'Nova Iguaçu', uf: 'RJ'}, {name: 'Niterói', uf: 'RJ'}, {name: 'Belford Roxo', uf: 'RJ'}, {name: 'São João de Meriti', uf: 'RJ'}, {name: 'Campos dos Goytacazes', uf: 'RJ'}, {name: 'Petrópolis', uf: 'RJ'}, {name: 'Volta Redonda', uf: 'RJ'},
        // Rio Grande do Norte
        {name: 'Natal', uf: 'RN'}, {name: 'Mossoró', uf: 'RN'}, {name: 'Parnamirim', uf: 'RN'},
        // Rio Grande do Sul
        {name: 'Porto Alegre', uf: 'RS'}, {name: 'Caxias do Sul', uf: 'RS'}, {name: 'Pelotas', uf: 'RS'}, {name: 'Canoas', uf: 'RS'}, {name: 'Santa Maria', uf: 'RS'}, {name: 'Gravataí', uf: 'RS'}, {name: 'Viamão', uf: 'RS'}, {name: 'Novo Hamburgo', uf: 'RS'}, {name: 'São Leopoldo', uf: 'RS'},
        // Rondônia
        {name: 'Porto Velho', uf: 'RO'}, {name: 'Ji-Paraná', uf: 'RO'}, {name: 'Ariquemes', uf: 'RO'},
        // Roraima
        {name: 'Boa Vista', uf: 'RR'}, {name: 'Rorainópolis', uf: 'RR'},
        // Santa Catarina
        {name: 'Florianópolis', uf: 'SC'}, {name: 'Joinville', uf: 'SC'}, {name: 'Blumenau', uf: 'SC'}, {name: 'São José', uf: 'SC'}, {name: 'Criciúma', uf: 'SC'}, {name: 'Chapecó', uf: 'SC'}, {name: 'Itajaí', uf: 'SC'},
        // São Paulo
        {name: 'São Paulo', uf: 'SP'}, {name: 'Guarulhos', uf: 'SP'}, {name: 'Campinas', uf: 'SP'}, {name: 'São Bernardo do Campo', uf: 'SP'}, {name: 'Santo André', uf: 'SP'}, {name: 'Osasco', uf: 'SP'}, {name: 'São José dos Campos', uf: 'SP'}, {name: 'Ribeirão Preto', uf: 'SP'}, {name: 'Sorocaba', uf: 'SP'}, {name: 'Santos', uf: 'SP'}, {name: 'Mauá', uf: 'SP'}, {name: 'São José do Rio Preto', uf: 'SP'}, {name: 'Mogi das Cruzes', uf: 'SP'}, {name: 'Diadema', uf: 'SP'}, {name: 'Jundiaí', uf: 'SP'}, {name: 'Carapicuíba', uf: 'SP'}, {name: 'Piracicaba', uf: 'SP'}, {name: 'Bauru', uf: 'SP'}, {name: 'Itaquaquecetuba', uf: 'SP'}, {name: 'São Vicente', uf: 'SP'}, {name: 'Franca', uf: 'SP'}, {name: 'Guarujá', uf: 'SP'}, {name: 'Taubaté', uf: 'SP'}, {name: 'Praia Grande', uf: 'SP'}, {name: 'Limeira', uf: 'SP'}, {name: 'Suzano', uf: 'SP'}, {name: 'Taboão da Serra', uf: 'SP'}, {name: 'Sumaré', uf: 'SP'}, {name: 'Barueri', uf: 'SP'}, {name: 'Embu das Artes', uf: 'SP'}, {name: 'São Carlos', uf: 'SP'}, {name: 'Marília', uf: 'SP'}, {name: 'Americana', uf: 'SP'}, {name: 'Presidente Prudente', uf: 'SP'}, {name: 'Araraquara', uf: 'SP'}, {name: 'Indaiatuba', uf: 'SP'}, {name: 'Jacareí', uf: 'SP'}, {name: 'Hortolândia', uf: 'SP'}, {name: 'Itu', uf: 'SP'}, {name: 'Cotia', uf: 'SP'}, {name: 'Pindamonhangaba', uf: 'SP'}, {name: 'Pederneiras', uf: 'SP'},
        // Sergipe
        {name: 'Aracaju', uf: 'SE'}, {name: 'Nossa Senhora do Socorro', uf: 'SE'}, {name: 'Lagarto', uf: 'SE'},
        // Tocantins
        {name: 'Palmas', uf: 'TO'}, {name: 'Araguaína', uf: 'TO'}, {name: 'Gurupi', uf: 'TO'}
    ];

    db.serialize(() => {
        // Primeiro, obtemos um mapa de UFs para IDs de estado para facilitar a busca
        db.all('SELECT id, uf FROM states', (err, states) => {
            if (err) return console.error('❌ Erro ao buscar estados para sincronização:', err.message);

            const stateMap = {};
            states.forEach(state => {
                stateMap[state.uf] = state.id;
            });

            // Para cada cidade na nossa lista alvo, verificamos se ela já existe
            targetCities.forEach(city => {
                const stateId = stateMap[city.uf];
                if (!stateId) {
                    console.warn(`⚠️ Estado ${city.uf} não encontrado no banco. Pulando cidade ${city.name}.`);
                    return;
                }

                // Verifica se a combinação de nome da cidade e ID do estado já existe
                const query = 'SELECT id FROM cities WHERE name = ? AND state_id = ?';
                db.get(query, [city.name, stateId], (err, row) => {
                    if (err) return console.error('❌ Erro ao verificar cidade:', err.message);

                    // Se 'row' não for encontrado, a cidade não existe e deve ser inserida
                    if (!row) {
                        db.run('INSERT INTO cities (name, state_id) VALUES (?, ?)', [city.name, stateId], function(err) {
                            if (err) {
                                console.error(`❌ Erro ao inserir ${city.name}:`, err.message);
                            } else {
                                console.log(`➕ Adicionando cidade ausente: ${city.name} - ${city.uf}`);
                            }
                        });
                    }
                });
            });
        });
    });
};

const checkAndFixFreightMapsConstraint = () => {
    db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='freight_maps'", (err, row) => {
        if (err) {
            console.error('❌ Erro ao verificar estrutura da tabela freight_maps:', err);
            return;
        }
        
        if (row && row.sql.match(/mapNumber\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i)) {
            console.log('⚠️ Constraint UNIQUE problemática encontrada na coluna mapNumber. Recriando tabela...');
            
            db.serialize(() => {
                db.run('ALTER TABLE freight_maps RENAME TO freight_maps_old', (err) => {
                    if (err) return console.error("Erro ao renomear tabela para backup:", err);
                });
                
                 // ✅ ADICIONE ESTA PARTE: Comando para adicionar a coluna deliveredStops
                db.run("ALTER TABLE freight_maps ADD COLUMN deliveredStops TEXT DEFAULT '[]'", (err) => {
                    if (err && err.message.includes('duplicate column name')) {
                        // Coluna já existe, o que é esperado após a primeira execução
                        console.log("Coluna 'deliveredStops' já existe na tabela.");
                    } else if (err) {
                        console.error("Erro ao adicionar coluna 'deliveredStops':", err.message);
                    } else {
                        console.log("✅ Coluna 'deliveredStops' adicionada com sucesso.");
                    }
                });

                db.run("ALTER TABLE freight_maps ADD COLUMN failedStops TEXT DEFAULT '[]'", (err) => {
                    if (err && err.message.includes('duplicate column name')) {
                        // Coluna já existe, o que é esperado após a primeira execução
                        console.log("Coluna 'failedStops' já existe na tabela.");
                    } else if (err) {
                        console.error("Erro ao adicionar coluna 'failedStops':", err.message);
                    } else {
                        console.log("✅ Coluna 'failedStops' adicionada com sucesso.");
                    }
                });

                // Recria a tabela com a estrutura correta (sem UNIQUE)
                db.run(`
                    CREATE TABLE freight_maps (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        mapNumber TEXT NOT NULL,
                        mapImage TEXT,
                        origin TEXT NOT NULL,
                        destination TEXT NOT NULL,
                        totalKm INTEGER NOT NULL,
                        weight REAL NOT NULL,
                        mapValue REAL NOT NULL,
                        truckType TEXT NOT NULL,
                        selectedCarrier TEXT,
                        loadingMode TEXT NOT NULL,
                        loadingDate TEXT NOT NULL,
                        routeInfo TEXT,
                        carrierProposals TEXT DEFAULT '{}',
                        finalValue REAL,
                        status TEXT DEFAULT 'negotiating',
                        contractedAt TEXT,
                        invoiceUrls TEXT DEFAULT '[]',
                        created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                        created_by TEXT,
                        managers TEXT,
                        userCounterProposal REAL,
                        selectedCarrierForCounter TEXT,
                        justification TEXT,
                        rejectedReason TEXT,
                        finalizationObservation TEXT,
                        routeData TEXT,
                        editObservations TEXT DEFAULT '[]',
                        assignedDriver TEXT,
                        trackingStatus TEXT DEFAULT 'waiting',
                        trackingHistory TEXT DEFAULT '[]',
                        deliveredStops TEXT DEFAULT '[]',
                        failedStops TEXT DEFAULT '[]'
                        
                    )
                `, (err) => {
                    if (err) return console.error("Erro ao criar nova tabela freight_maps:", err);
                });
                
                db.run(`INSERT INTO freight_maps (id, mapNumber, mapImage, origin, destination, totalKm, weight, mapValue, truckType, selectedCarrier, loadingMode, loadingDate, routeInfo, carrierProposals, finalValue, status, contractedAt, invoiceUrls, created_date, updated_date, created_by, managers, userCounterProposal, selectedCarrierForCounter, justification, rejectedReason, finalizationObservation, routeData, editObservations) SELECT id, mapNumber, mapImage, origin, destination, totalKm, weight, mapValue, truckType, selectedCarrier, loadingMode, loadingDate, routeInfo, carrierProposals, finalValue, status, contractedAt, invoiceUrls, created_date, updated_date, created_by, managers, userCounterProposal, selectedCarrierForCounter, justification, rejectedReason, finalizationObservation, routeData, editObservations FROM freight_maps_old`, (err) => {
                    if (err) return console.error("Erro ao copiar dados da tabela antiga:", err);
                });
                
                db.run('DROP TABLE freight_maps_old', (err) => {
                    if (err) console.error('❌ Erro ao limular tabela antiga:', err);
                    else console.log('✅ Constraint UNIQUE removida com sucesso da tabela freight_maps!');
                });
            });
        } else {
            console.log('✅ Tabela freight_maps não possui constraint UNIQUE problemática.');
        }
    });
};

const runMigrations = () => {
    db.all("PRAGMA table_info(freight_maps)", (err, columns) => {
        if (err) return console.error("❌ Erro ao ler estrutura da tabela freight_maps:", err.message);
        
        const runAlter = (colName, colType, defaultValue = null) => {
            if (!columns.some(col => col.name === colName)) {
                console.log(`⚠️ Coluna '${colName}' não encontrada. Adicionando...`);
                let alterStatement = `ALTER TABLE freight_maps ADD COLUMN ${colName} ${colType}`;
                if (defaultValue) {
                    alterStatement += ` DEFAULT ${defaultValue}`;
                }
                db.run(alterStatement, (err) => {
                    if (err) console.error(`❌ Erro ao adicionar a coluna ${colName}:`, err.message);
                    else console.log(`✅ Coluna '${colName}' adicionada com sucesso!`);
                });
            }
        };

        runAlter('managers', 'TEXT');
        runAlter('userCounterProposal', 'REAL');
        runAlter('selectedCarrierForCounter', 'TEXT');
        runAlter('justification', 'TEXT');
        runAlter('rejectedReason', 'TEXT');
        runAlter('finalizationObservation', 'TEXT');
        runAlter('editObservations', "TEXT", "'[]'");
        runAlter('routeData', 'TEXT');
        // ✅ NOVO: Adicionando campos de rastreamento
        runAlter('assignedDriver', 'TEXT');
        runAlter('trackingStatus', 'TEXT', "'waiting'");
        runAlter('trackingHistory', 'TEXT', "'[]'");
        // ✅ 1. ALTERAÇÃO PRINCIPAL: Garante que a coluna 'deliveredStops' exista.
        runAlter('deliveredStops', 'TEXT', "'[]'");
        runAlter('failedStops', 'TEXT', "'[]'");
        // ✅ ADICIONADO: Garante que as colunas de ocorrência existam
        runAlter('occurrences', 'TEXT', "'[]'");
        runAlter('occurrenceImages', 'TEXT', "'[]'");
        runAlter('fuelPrice', 'REAL');
        runAlter('fuelEfficiency', 'REAL');
    });
};

const createDefaultAdmin = async () => {
    try {
        db.get('SELECT * FROM users WHERE username = ?', ['admin'], async (err, row) => {
            if (err) return console.error('❌ Erro ao verificar admin:', err);
            if (!row) {
                const hashedPassword = await bcrypt.hash('admin123', 10);
                db.run(`INSERT INTO users (fullName, username, email, password, userType, active) VALUES (?, ?, ?, ?, ?, ?)`, 
                    ['Administrador do Sistema', 'admin', 'admin@unionagro.com', hashedPassword, 'admin', 1], 
                    (err) => {
                        if (err) console.error('❌ Erro ao criar admin padrão:', err);
                        else console.log('✅ Usuário administrador padrão criado (admin/admin123)');
                    }
                );
            }
        });
    } catch (error) {
        console.error('❌ Erro ao criar admin padrão:', error);
    }
};

// --- ROTAS DA API ---

// ✅ ATUALIZADO: Rota de autenticação com suporte para login por CPF (motoristas)
// Rota de login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // Se não houver senha, consideramos um login de motorista via CPF
    if (!password) {
        const cpf = username; // O campo de usuário conterá o CPF
        if (!cpf) {
            return res.status(400).json({ error: 'CPF é obrigatório.' });
        }
        
        // Procura por um motorista ativo com o CPF fornecido
        const sql = `SELECT * FROM users WHERE cpf = ? AND userType = 'driver'`;
        
        db.get(sql, [cpf], (err, user) => {
            if (err) {
                console.error('Erro no banco de dados:', err);
                return res.status(500).json({ error: 'Erro interno do servidor' });
            }
            
            if (!user) {
                return res.status(404).json({ error: 'Motorista não encontrado' });
            }

            if (!user.active) {
                return res.status(403).json({ error: 'Usuário inativo' });
            }
            
            // Se encontrou, retorna os dados do usuário (sem a senha)
            const { password, ...userData } = user;
            res.json(userData);
        });

    } else {
    // Caso contrário, executa o login padrão com usuário e senha
        const sql = `SELECT * FROM users WHERE username = ?`;

        db.get(sql, [username], (err, user) => {
            if (err) {
                console.error('Erro no banco de dados:', err);
                return res.status(500).json({ error: 'Erro interno do servidor' });
            }
            
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }

            if (!user.active) {
                return res.status(403).json({ error: 'Usuário inativo' });
            }
            
            // Compara a senha fornecida com a senha hash no banco
            bcrypt.compare(password, user.password, (err, result) => {
                if (err || !result) {
                    return res.status(401).json({ error: 'Senha inválida' });
                }
                
                const { password, ...userData } = user;
                res.json(userData);
            });
        });
    }
});

// Rotas para Estados
app.get('/api/states', (req, res) => {
    if (!db) return res.status(500).json({ error: 'Banco de dados não conectado' });
    
    db.all('SELECT * FROM states ORDER BY name ASC', (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar estados:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Rotas para Cidades
app.get('/api/cities', (req, res) => {
    if (!db) return res.status(500).json({ error: 'Banco de dados não conectado' });
    
    let query = 'SELECT c.*, s.name as state_name, s.uf as state_uf FROM cities c JOIN states s ON c.state_id = s.id';
    const params = [];
    
    if (req.query.state_id) {
        query += ' WHERE c.state_id = ?';
        params.push(req.query.state_id);
    }
    
    query += ' ORDER BY c.name ASC';
    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('❌ Erro ao buscar cidades:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// ✅ ATUALIZADO: Rotas CRUD para Users com suporte para motoristas
app.get('/api/users', (req, res) => {
    if (!db) return res.status(500).json({ error: 'Banco de dados não conectado' });
    db.all('SELECT id, fullName, username, email, userType, carrierName, cpf, phone, assignedMapNumber, active, created_date, requirePasswordChange FROM users ORDER BY created_date DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/users', async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Banco de dados não conectado' });
    const { fullName, username, email, password, userType, carrierName, cpf, phone, assignedMapNumber, active, requirePasswordChange } = req.body;

    if (!fullName || !username || !email || !password || !userType) {
        return res.status(400).json({ error: 'Por favor, preencha todos os campos obrigatórios.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO users (fullName, username, email, password, userType, carrierName, cpf, phone, assignedMapNumber, active, requirePasswordChange) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        db.run(sql, [fullName, username, email, hashedPassword, userType, carrierName || null, cpf || null, phone || null, assignedMapNumber || null, active !== false, requirePasswordChange === true], function(err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT') {
                    if (err.message.includes('users.email')) return res.status(400).json({ error: 'Este email já está cadastrado no sistema.' });
                    if (err.message.includes('users.username')) return res.status(400).json({ error: 'Este nome de usuário já está em uso.' });
                }
                console.error('Erro ao criar usuário:', err);
                return res.status(500).json({ error: 'Ocorreu um erro interno ao criar o usuário.' });
            }
            res.status(201).json({ id: this.lastID, message: 'Usuário criado com sucesso!' });
        });
    } catch (error) {
        console.error('Erro ao processar senha:', error);
        res.status(500).json({ error: 'Erro ao processar senha' });
    }
});

app.put('/api/users/:id', async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Banco de dados não conectado' });
    const { id } = req.params;
    const updates = req.body;

    delete updates.id;
    delete updates.created_date;

    try {
        if (updates.password) {
            if (updates.password.length < 6) return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
            updates.password = await bcrypt.hash(updates.password, 10);
        }

        const fields = Object.keys(updates);
        if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar foi fornecido.' });
        
        const setClause = fields.map(field => `${field} = ?`).join(', ');
        const values = fields.map(field => updates[field]);

        const sql = `UPDATE users SET ${setClause}, updated_date = CURRENT_TIMESTAMP WHERE id = ?`;
        
        db.run(sql, [...values, id], function(err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT') {
                    if (err.message.includes('users.email')) return res.status(400).json({ error: 'Este email já está sendo usado por outro usuário.' });
                    if (err.message.includes('users.username')) return res.status(400).json({ error: 'Este nome de usuário já está em uso.' });
                }
                console.error('Erro ao atualizar usuário:', err);
                return res.status(500).json({ error: 'Ocorreu um erro interno ao atualizar o usuário.' });
            }
            if (this.changes === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
            res.json({ message: 'Usuário atualizado com sucesso!' });
        });
    } catch (error) {
        console.error('Erro ao processar atualização do usuário:', error);
        res.status(500).json({ error: 'Ocorreu um erro de segurança interno.' });
    }
});

app.delete('/api/users/:id', (req, res) => {
    if (!db) return res.status(500).json({ error: 'Banco de dados não conectado' });
    db.run('DELETE FROM users WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json({ message: 'Usuário deletado com sucesso' });
    });
});

// Rotas CRUD para Truck Types
app.get('/api/truck-types', (req, res) => {
    if (!db) return res.status(500).json({ error: 'Banco de dados não conectado' });
    db.all('SELECT * FROM truck_types ORDER BY created_date DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/truck-types', (req, res) => {
    if (!db) return res.status(500).json({ error: 'Banco de dados não conectado' });
    const { name, capacity, baseRate, modality } = req.body;
    db.run(`INSERT INTO truck_types (name, capacity, baseRate, modality) VALUES (?, ?, ?, ?)`, [name, capacity, baseRate, modality], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, message: 'Tipo de caminhão criado com sucesso' });
    });
});

app.put('/api/truck-types/:id', (req, res) => {
    if (!db) return res.status(500).json({ error: 'Banco de dados não conectado' });
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates);
    if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    db.run(`UPDATE truck_types SET ${setClause}, updated_date = CURRENT_TIMESTAMP WHERE id = ?`, [...Object.values(updates), id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Tipo de caminhão não encontrado' });
        res.json({ message: 'Tipo de caminhão atualizado com sucesso' });
    });
});

app.delete('/api/truck-types/:id', (req, res) => {
    if (!db) return res.status(500).json({ error: 'Banco de dados não conectado' });
    db.run('DELETE FROM truck_types WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Tipo de caminhão não encontrado' });
        if (this.changes === 0) return res.status(404).json({ error: 'Tipo de caminhão não encontrado' });
        res.json({ message: 'Tipo de caminhão deletado com sucesso' });
    });
});

// Rotas CRUD para Carriers
app.get('/api/carriers', (req, res) => {
    if (!db) return res.status(500).json({ error: 'Banco de dados não conectado' });
    db.all('SELECT * FROM carriers ORDER BY name ASC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const results = rows.map(row => ({ ...row, modalities: JSON.parse(row.modalities || '[]') }));
        res.json(results);
    });
});

app.post('/api/carriers', (req, res) => {
    if (!db) return res.status(500).json({ error: 'Banco de dados não conectado' });
    const { name, modalities, active } = req.body;
    if (!name || !modalities || modalities.length === 0) return res.status(400).json({ error: 'Nome e pelo menos uma modalidade são obrigatórios' });
    const modalitiesJSON = JSON.stringify(modalities);
    db.run(`INSERT INTO carriers (name, modalities, active) VALUES (?, ?, ?)`, [name, modalitiesJSON, active], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, name, modalities, active });
    });
});

app.put('/api/carriers/:id', (req, res) => {
    if (!db) return res.status(500).json({ error: 'Banco de dados não conectado' });
    const { id } = req.params;
    const { name, modalities, active } = req.body;
    if (!name || !modalities || modalities.length === 0) return res.status(400).json({ error: 'Nome e pelo menos uma modalidade são obrigatórios' });
    const modalitiesJSON = JSON.stringify(modalities);
    const sql = `UPDATE carriers SET name = ?, modalities = ?, active = ?, updated_date = CURRENT_TIMESTAMP WHERE id = ?`;
    db.run(sql, [name, modalitiesJSON, active, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Transportadora não encontrada' });
        res.json({ id: Number(id), name, modalities, active });
    });
});

app.delete('/api/carriers/:id', (req, res) => {
    if (!db) return res.status(500).json({ error: 'Banco de dados não conectado' });
    db.run('DELETE FROM carriers WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Transportadora não encontrada' });
        res.json({ message: 'Transportadora deletada com sucesso' });
    });
});

// ✅ ATUALIZADO: Rotas CRUD para Freight Maps com campos de rastreamento e ocorrências
app.get('/api/freight-maps', (req, res) => {
    if (!db) return res.status(500).json({ error: 'Banco de dados não conectado' });
    
    const { status, selectedCarrier, assignedDriver } = req.query;
    
    let sql = 'SELECT * FROM freight_maps';
    const params = [];
    const conditions = [];

    if (status) {
        conditions.push('status = ?');
        params.push(status);
    }
    if (selectedCarrier) {
        conditions.push('selectedCarrier = ?');
        params.push(selectedCarrier);
    }
    if (assignedDriver) {
        conditions.push('assignedDriver = ?');
        params.push(assignedDriver);
    }

    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY created_date DESC';

    db.all(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        // ✅ CORREÇÃO CENTRAL: Deserializa os campos JSON antes de enviar para o cliente
        const maps = rows.map(row => {
            try {
                row.managers = JSON.parse(row.managers || '[]');
                row.carrierProposals = JSON.parse(row.carrierProposals || '{}');
                row.invoiceUrls = JSON.parse(row.invoiceUrls || '[]');
                row.editObservations = JSON.parse(row.editObservations || '[]');
                row.routeData = JSON.parse(row.routeData || 'null'); // <-- Correção crucial aqui
                row.trackingHistory = JSON.parse(row.trackingHistory || '[]');
                row.deliveredStops = JSON.parse(row.deliveredStops || '[]');
                row.failedStops = JSON.parse(row.failedStops || '[]');
                row.occurrences = JSON.parse(row.occurrences || '[]');
                row.occurrenceImages = JSON.parse(row.occurrenceImages || '[]');
            } catch (e) {
                console.error(`Error parsing JSON for map ID ${row.id}:`, e);
                // Define valores padrão em caso de erro de parsing para evitar quebrar o frontend
                row.managers = [];
                row.carrierProposals = {};
                row.invoiceUrls = [];
                row.editObservations = [];
                row.routeData = null;
                row.trackingHistory = [];
                row.deliveredStops = [];
                row.failedStops = [];
                row.occurrences = [];
                row.occurrenceImages = [];
            }
            return row;
        });

        res.json(maps);
    });
});

// ✅ ATUALIZADO: Rota para criar um novo freight map com campos de rastreamento e ocorrências
app.post('/api/freight-maps', (req, res) => {
    if (!db) return res.status(500).json({ error: 'Banco de dados não conectado' });
    
    const {
        mapNumber, mapImage, origin, destination, totalKm, weight, mapValue,
        truckType, selectedCarrier, loadingMode, loadingDate, routeInfo,
        managers, carrierProposals, status, created_by, editObservations, routeData,
        fuelPrice, fuelEfficiency
    } = req.body;

    console.log(`📦 Criando freight map: ${mapNumber} para ${selectedCarrier}`);
    
    const now = getBrazilIsoNow();

    const sql = `
        INSERT INTO freight_maps (
            mapNumber, mapImage, origin, destination, totalKm, weight, mapValue, 
            truckType, selectedCarrier, loadingMode, loadingDate, routeInfo, 
            managers, carrierProposals, status, created_by, editObservations, routeData,
            assignedDriver, trackingStatus, trackingHistory, deliveredStops, failedStops,
            occurrences, occurrenceImages, fuelPrice, fuelEfficiency,
            created_date, updated_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
        mapNumber,
        mapImage || '',
        origin,
        destination,
        totalKm,
        weight,
        mapValue,
        truckType,
        selectedCarrier,
        loadingMode,
        loadingDate,
        routeInfo || '',
        JSON.stringify(managers || []),
        JSON.stringify(carrierProposals || {}),
        status || 'negotiating',
        created_by || 'system',
        JSON.stringify(editObservations || []),
        JSON.stringify(routeData || null),
        null, // assignedDriver
        'waiting', // trackingStatus
        JSON.stringify([]), // trackingHistory
        JSON.stringify([]), // deliveredStops
        JSON.stringify([]), // failedStops
        JSON.stringify([]), // occurrences
        JSON.stringify([]), // occurrenceImages
        fuelPrice || null, // ✅ ADICIONADO: fuelPrice
        fuelEfficiency || null, // ✅ ADICIONADO: fuelEfficiency
        now, // Data de criação
        now  // Data de atualização
    ];

    db.run(sql, params, function(err) {
        if (err) {
            console.error('❌ Erro ao criar freight map:', err);
            return res.status(500).json({ error: err.message });
        }
        const createdId = this.lastID;
        console.log(`✅ Freight map criado com sucesso: ${mapNumber} para ${selectedCarrier} (ID: ${createdId})`);
        
        db.get('SELECT * FROM freight_maps WHERE id = ?', [createdId], (err, row) => {
             if (err) {
                return res.status(500).json({ error: "Erro ao buscar o mapa recém-criado."});
            }
            row.managers = JSON.parse(row.managers || '[]');
            row.carrierProposals = JSON.parse(row.carrierProposals || '{}');
            row.invoiceUrls = JSON.parse(row.invoiceUrls || '[]');
            row.editObservations = JSON.parse(row.editObservations || '[]');
            row.routeData = JSON.parse(row.routeData || 'null');
            row.trackingHistory = JSON.parse(row.trackingHistory || '[]');
            row.deliveredStops = JSON.parse(row.deliveredStops || '[]');
            row.failedStops = JSON.parse(row.failedStops || '[]');
            row.occurrences = JSON.parse(row.occurrences || '[]');
            row.occurrenceImages = JSON.parse(row.occurrenceImages || '[]');
            res.status(201).json(row);
        });
    });
});

app.put('/api/freight-maps/:id', (req, res) => {
    if (!db) return res.status(500).json({ error: 'Banco de dados não conectado' });
    const { id } = req.params;
    const updates = req.body;
    
    if (updates.managers) updates.managers = JSON.stringify(updates.managers);
    if (updates.carrierProposals) updates.carrierProposals = JSON.stringify(updates.carrierProposals);
    if (updates.invoiceUrls) updates.invoiceUrls = JSON.stringify(updates.invoiceUrls);
    if (updates.routeData) updates.routeData = JSON.stringify(updates.routeData);
    if (updates.trackingHistory) updates.trackingHistory = JSON.stringify(updates.trackingHistory);
    if (updates.deliveredStops) updates.deliveredStops = JSON.stringify(updates.deliveredStops);
    if (updates.occurrences) updates.occurrences = JSON.stringify(updates.occurrences);
    if (updates.occurrenceImages) updates.occurrenceImages = JSON.stringify(updates.occurrenceImages);
    if (updates.failedStops) updates.failedStops = JSON.stringify(updates.failedStops);
    if (updates.editObservations) {
        if (!Array.isArray(updates.editObservations)) {
            return res.status(400).json({ error: 'editObservations deve ser um array.' });
        }
        updates.editObservations = JSON.stringify(updates.editObservations);
    }

    const fields = Object.keys(updates).filter(key => key !== 'id');
    if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    
    db.run(`UPDATE freight_maps SET ${setClause}, updated_date = ? WHERE id = ?`, [...Object.values(updates), getBrazilIsoNow(), id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Freight map não encontrado' });
        
        db.get('SELECT * FROM freight_maps WHERE id = ?', [id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (row) {
                row.managers = JSON.parse(row.managers || '[]');
                row.carrierProposals = JSON.parse(row.carrierProposals || '{}');
                row.invoiceUrls = JSON.parse(row.invoiceUrls || '[]');
                row.editObservations = JSON.parse(row.editObservations || '[]');
                row.routeData = JSON.parse(row.routeData || 'null');
                row.trackingHistory = JSON.parse(row.trackingHistory || '[]');
                row.deliveredStops = JSON.parse(row.deliveredStops || '[]');
                row.occurrences = JSON.parse(row.occurrences || '[]');
                row.occurrenceImages = JSON.parse(row.occurrenceImages || '[]');
                row.failedStops = JSON.parse(row.failedStops || '[]');
            }
            res.json(row);
        });
    });
});

app.delete('/api/freight-maps/:id', (req, res) => {
    if (!db) return res.status(500).json({ error: 'Banco de dados não conectado' });
    db.run('DELETE FROM freight_maps WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Freight map não encontrado' });
        res.json({ message: 'Freight map deletado com sucesso' });
    });
});

// Rota de envio de email
 app.post('/api/send-email', async (req, res) => {
   try {
     const { to, subject, html } = req.body;
     console.log('=== INÍCIO DEBUG EMAIL ===');
     console.log('SENDGRID_API_KEY existe?', !!process.env.SENDGRID_API_KEY);
     console.log('SENDGRID_API_KEY começa com SG.?', process.env.SENDGRID_API_KEY?.startsWith('SG.'));
     console.log('FROM EMAIL:', process.env.SENDGRID_FROM_EMAIL);
     console.log('TO EMAIL:', to);
     console.log('SUBJECT:', subject);
     console.log('=== FIM DEBUG EMAIL ===');
     if (!to || !subject || !html) return res.status(400).json({ error: 'Campos obrigatórios: to, subject, html' });
     const msg = { to, from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'UnionAgro Fretes' }, subject, html };
     console.log('Mensagem a ser enviada:', JSON.stringify(msg, null, 2));
     const response = await sgMail.send(msg);
     console.log('✅ SUCESSO! Resposta do SendGrid:', response[0].statusCode);
     res.json({ success: true, message: 'Email enviado com sucesso' });
   } catch (error) {
     console.error('❌ ERRO DETALHADO:');
     console.error('- Message:', error.message);
     console.error('- Code:', error.code);
     console.error('- Response Status:', error.response?.status);
     console.error('- Response Body:', JSON.stringify(error.response?.body, null, 2));
     const errorMessage = error.response?.body?.errors?.[0]?.message || error.message || 'Erro desconhecido';
     res.status(500).json({ error: 'Falha ao enviar o email', details: errorMessage, sendgridError: error.response?.body });
   }
 });

// Rota para upload de arquivos
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    
    const SERVER_IP = process.env.SERVER_IP || 'localhost'; 
    
    const fileUrl = `http://${SERVER_IP}:${PORT}/uploads/${req.file.filename}`;
    
    console.log(`✅ Arquivo enviado. URL gerada: ${fileUrl}`);
    res.json({ file_url: fileUrl });
});

// =================================================================
// FUNÇÕES AUXILIARES E DE PROCESSAMENTO
// =================================================================

// ✅ FUNÇÃO PARA DECODIFICAR POLYLINE DA ROTA (Versão única e limpa)
function decodePolyline(str, precision = 5) {
    let index = 0, lat = 0, lng = 0, coordinates = [], shift = 0, result = 0, byte = null, latitude_change, longitude_change;
    const factor = Math.pow(10, precision);
    while (index < str.length) {
        byte = null; shift = 0; result = 0;
        do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
        latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        shift = result = 0;
        do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
        longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += latitude_change; lng += longitude_change;
        coordinates.push([lat / factor, lng / factor]);
    }
    return coordinates;
}

// ✅ FUNÇÃO PARA MAPEAMENTO DE EIXOS (Versão única e limpa)
function mapAxlesToVehicleType(axles) {
    if (axles <= 2) return '2AxlesTruck';
    if (axles >= 7) return '7AxlesTruck';
    return `${axles}AxlesTruck`;
}

// ✅ FUNÇÃO DE GEOCODIFICAÇÃO (Versão robusta com retentativas)
async function getCoords(city, state, retryCount = 0) {
  const query = encodeURIComponent(`${city}, ${state}, Brazil`);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`;
  if (retryCount > 0) { await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount - 1) * 1000)); }
  try {
    console.log(`🔍 Geocoding: ${city}, ${state}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, { headers: { 'User-Agent': 'UnionAgroFreightApp/1.0' }, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`API Nominatim respondeu com status: ${response.status}`);
    const data = await response.json();
    if (data && data.length > 0) {
      const result = data[0];
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);
      if (isNaN(lat) || isNaN(lon)) throw new Error(`Coordenadas inválidas de Nominatim: lat=${result.lat}, lon=${result.lon}`);
      return { lat, lon };
    } else {
      throw new Error(`Nenhum resultado de geocodificação encontrado para ${city}, ${state}`);
    }
  } catch (e) {
    if (retryCount < 2) return getCoords(city, state, retryCount + 1);
  }
  return null;
}


// =================================================================
// LÓGICA DAS APIS DE ROTEAMENTO
// =================================================================

// ✅ FUNÇÃO 1: Tenta buscar e processar a rota da TOLLGURU (VERSÃO CORRIGIDA)
async function fetchAndProcessTollGuruRoute(apiKey, requestBody) {
  const tollguruUrl = 'https://apis.tollguru.com/toll/v2/origin-destination-waypoints';
  console.log(`➡️  Enviando para TollGuru...`);

  const response = await fetch(tollguruUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'tg_9D41EAA999074A99AB63FF2149F0D3DC' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`TollGuru respondeu com status ${response.status}: ${errorBody}`);
  }

  const data = await response.json();

  if (!data.routes || data.routes.length === 0) {
    throw new Error("Resposta da TollGuru inválida ou sem rotas.");
  }
  
  // Lógica de extração de dados corrigida e robusta
  const route = data.routes[0];
  const summary = route.summary || data.summary || {}; // Procura o summary na rota primeiro, depois no geral
  const costs = route.costs || summary.costs || {}; // Procura custos na rota primeiro
  const tollsArray = route.tolls || summary.tolls || []; // Procura pedágios na rota primeiro

  console.log(`[TollGuru Process] Rota encontrada. Distância: ${summary.distance?.value}, Duração: ${summary.duration?.value}, Pedágios encontrados: ${tollsArray.length}`);

  const tollData = {
    tolls: tollsArray.map(toll => ({ ...toll, cost: toll.tagCost || toll.cashCost || 0 })),
    totalCost: costs.tag ?? costs.cash ?? 0,
    currency: costs.currency || 'BRL',
  };

  return {
    distance: (summary.distance?.value ?? 0) / 1000,
    duration: (summary.duration?.value ?? 0) / 3600,
    geometry: route.polyline ? decodePolyline(route.polyline) : [],
    tollData,
    fuel: summary.fuel || null,
    source: 'tollguru'
  };
}

// ✅ FUNÇÃO 2: Tenta buscar e processar a rota do OPENROUTESERVICE (Fallback)
async function fetchAndProcessOpenRouteServiceRoute(apiKey, requestBody) {
  const orsUrl = 'https://api.openrouteservice.org/v2/directions/driving-car';
  console.log(`🔄 Fallback: Enviando para OpenRouteService...`);

  const orsRequestBody = {
    coordinates: [
      [requestBody.from.lng, requestBody.from.lat],
      ...requestBody.waypoints.map(wp => [wp.lng, wp.lat]),
      [requestBody.to.lng, requestBody.to.lat]
    ],
    geometry: true,
  };
  
  const response = await fetch(orsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': apiKey, 'Accept': 'application/json' },
    body: JSON.stringify(orsRequestBody)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouteService respondeu com status ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  if (!data.routes || data.routes.length === 0) {
    throw new Error("Resposta do OpenRouteService inválida ou sem rotas.");
  }

  const route = data.routes[0];
  const summary = route.summary;

  return {
    distance: (summary.distance / 1000),
    duration: (summary.duration / 3600),
    geometry: route.geometry ? decodePolyline(route.geometry) : [],
    tollData: { tolls: [], totalCost: 0, currency: 'BRL' }, // ORS não fornece dados de pedágio
    fuel: null, // ORS não fornece dados de combustível
    source: 'openrouteservice'
  };
}


// =================================================================
// ROTA PRINCIPAL DO EXPRESS
// =================================================================

app.post('/api/calculate-route', async (req, res) => {
    try {
        const { destinations, weight, axles, fuelPrice, fuelEfficiency } = req.body;

        if (!destinations || !Array.isArray(destinations) || destinations.length === 0) {
            return res.status(400).json({ error: 'A lista de destinos é obrigatória.' });
        }

        const coordsPromises = destinations.map(d => getCoords(d.city, d.state));
        const coordsList = await Promise.all(coordsPromises);

        if (coordsList.some(c => !c)) {
            const failedCity = destinations[coordsList.findIndex(c => !c)];
            return res.status(404).json({ error: `Não foi possível encontrar as coordenadas para ${failedCity.city}, ${failedCity.state}.` });
        }

        const tollguruApiKey = process.env.TOLLGURU_API_KEY;
        const orsApiKey = process.env.OPENROUTESERVICE_API_KEY;

        if (!tollguruApiKey || !orsApiKey) { 
            return res.status(500).json({ error: "As chaves de API para TollGuru e OpenRouteService são necessárias." }); 
        }
        
        const vehicle = {
            type: mapAxlesToVehicleType(axles || 2),
            axles: axles || 2,
            weight: { value: weight || 15000, unit: "kg" },
            fuelPrice: { value: parseFloat(fuelPrice) || 0, currency: "BRL" },
            fuelEfficiency: { hwy: parseFloat(fuelEfficiency) || 0, city: parseFloat(fuelEfficiency) || 0, units: "kmpl" },
        };

        const originCoords = { lat: -22.3601, lon: -48.9715 };
        const finalDestinationCoords = coordsList[coordsList.length - 1];
        const waypointsCoords = coordsList.slice(0, -1);

        const baseBody = {
            from: { lat: originCoords.lat, lng: originCoords.lon },
            to: { lat: finalDestinationCoords.lat, lng: finalDestinationCoords.lon },
            waypoints: waypointsCoords.map(wp => ({ lat: wp.lat, lng: wp.lon })),
            serviceProvider: "here",
            vehicle,
        };

        // Função interna para buscar rota com fallback
        const fetchRouteWithFallback = async (routeType) => {
            const tgBody = { ...baseBody, routeType: routeType, alternatives: 0 };
            try {
                return await fetchAndProcessTollGuruRoute(tollguruApiKey, tgBody);
            } catch (error) {
                console.warn(`⚠️  TollGuru falhou para a rota ${routeType}:`, error.message);
                return await fetchAndProcessOpenRouteServiceRoute(orsApiKey, baseBody);
            }
        };

        const [economicRouteData, shortestRouteData] = await Promise.all([
            fetchRouteWithFallback('fastest'),
            fetchRouteWithFallback('shortest')
        ]);
        
        const fractionalRoutesPromises = coordsList.map(async (destCoord, index) => {
            const fractionalBody = { ...baseBody, to: { lat: destCoord.lat, lng: destCoord.lon }, waypoints: [] };
            try {
                return await fetchAndProcessTollGuruRoute(tollguruApiKey, { ...fractionalBody, routeType: 'fastest', alternatives: 0 });
            } catch (error) {
                console.warn(`⚠️  TollGuru falhou para a rota fracionada ${destinations[index].city}. Tentando fallback...`);
                return await fetchAndProcessOpenRouteServiceRoute(orsApiKey, fractionalBody);
            }
        });
        
        const fractionalRoutesData = await Promise.all(fractionalRoutesPromises);
        
        res.json({
            origin: { coordinates: [originCoords.lat, originCoords.lon] },
            destination: { name: `Destino: ${destinations[destinations.length - 1].city}/${destinations[destinations.length - 1].state}`, coordinates: [finalDestinationCoords.lat, finalDestinationCoords.lon] },
            waypoints: waypointsCoords.map((coord, i) => ({ name: `Parada ${i + 1}: ${destinations[i].city}/${destinations[i].state}`, coordinates: [coord.lat, coord.lon] })),
            routes: {
                economic: economicRouteData,
                shortest: shortestRouteData
            },
            fractionalRoutes: fractionalRoutesData.map((data, index) => ({
                destination: destinations[index],
                data: data
            })),
            fallbackUsed: (economicRouteData?.source === 'openrouteservice') || (shortestRouteData?.source === 'openrouteservice')
        });

    } catch (error) {
        console.error('❌ Erro fatal no endpoint /api/calculate-route:', error.stack);
        res.status(500).json({ error: 'Erro interno no servidor ao calcular a rota. Verifique os logs.' });
    }
});
// Inicializar banco de dados e servidor
initDatabase();

app.listen(PORT, '0.0.0.0', () => { // ✅ CORREÇÃO: Faz o servidor escutar em todas as interfaces de rede
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📁 Uploads disponíveis em http://localhost:${PORT}/uploads/`);
});

// Fechar conexão graciosamente
process.on('SIGINT', () => {
    console.log('\n🔄 Fechando conexão com o banco de dados...');
    if (db) {
        db.close((err) => {
            if (err) console.error('❌ Erro ao fechar banco:', err.message);
            else console.log('✅ Conexão com banco fechada.');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});