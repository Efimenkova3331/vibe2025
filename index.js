const http = require('http');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const url = require('url');

const PORT = 3000;

// Database connection settings
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'todolist',
};

async function retrieveListItems() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute('SELECT id, text FROM items');
        await connection.end();
        return rows;
    } catch (error) {
        console.error('Error retrieving list items:', error);
        throw error;
    }
}

async function addItem(text) {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [result] = await connection.execute(
            'INSERT INTO items (text) VALUES (?)',
            [text]
        );
        await connection.end();
        return result.insertId;
    } catch (error) {
        console.error('Error adding item:', error);
        throw error;
    }
}

async function deleteItem(id) {
    try {
        const connection = await mysql.createConnection(dbConfig);
        await connection.execute(
            'DELETE FROM items WHERE id = ?',
            [id]
        );
        await connection.end();
    } catch (error) {
        console.error('Error deleting item:', error);
        throw error;
    }
}

async function updateItem(id, text) {
    try {
        const connection = await mysql.createConnection(dbConfig);
        await connection.execute(
            'UPDATE items SET text = ? WHERE id = ?',
            [text, id]
        );
        await connection.end();
    } catch (error) {
        console.error('Error updating item:', error);
        throw error;
    }
}

async function getHtmlRows() {
    const todoItems = await retrieveListItems();
    return todoItems.map(item => `
        <tr>
            <td>${item.id}</td>
            <td>
                <span class="item-text">${item.text}</span>
                <input class="edit-input" type="text" value="${item.text}" style="display:none;">
            </td>
            <td>
                <button class="edit-btn" onclick="startEdit(${item.id})">Edit</button>
                <button class="save-btn" onclick="saveEdit(${item.id})" style="display:none;">Save</button>
                <button onclick="removeItem(${item.id})">Remove</button>
            </td>
        </tr>
    `).join('');
}

async function handleRequest(req, res) {
    const reqUrl = url.parse(req.url, true);
    
    // API endpoints
    if (reqUrl.pathname === '/api/items' && req.method === 'GET') {
        try {
            const items = await retrieveListItems();
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify(items));
        } catch (error) {
            res.writeHead(500);
            res.end('Database error');
        }
    }
    else if (reqUrl.pathname === '/api/items' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { text } = JSON.parse(body);
                if (!text || typeof text !== 'string') {
                    res.writeHead(400);
                    return res.end('Invalid input');
                }
                
                await addItem(text);
                res.writeHead(201);
                res.end();
            } catch (error) {
                res.writeHead(500);
                res.end('Add error');
            }
        });
    }
    else if (reqUrl.pathname.startsWith('/api/items/') && req.method === 'DELETE') {
        const id = parseInt(reqUrl.pathname.split('/')[3]);
        if (isNaN(id)) {
            res.writeHead(400);
            return res.end('Invalid ID');
        }
        
        try {
            await deleteItem(id);
            res.writeHead(200);
            res.end();
        } catch (error) {
            res.writeHead(500);
            res.end('Delete error');
        }
    }
    else if (reqUrl.pathname.startsWith('/api/items/') && req.method === 'PUT') {
        const id = parseInt(reqUrl.pathname.split('/')[3]);
        if (isNaN(id)) {
            res.writeHead(400);
            return res.end('Invalid ID');
        }
        
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { text } = JSON.parse(body);
                if (!text || typeof text !== 'string') {
                    res.writeHead(400);
                    return res.end('Invalid input');
                }
                
                await updateItem(id, text);
                res.writeHead(200);
                res.end();
            } catch (error) {
                res.writeHead(500);
                res.end('Update error');
            }
        });
    }
    // Main page
    else if (req.url === '/') {
        try {
            const html = await fs.promises.readFile(
                path.join(__dirname, 'index.html'), 
                'utf8'
            );
            
            const processedHtml = html.replace('{{rows}}', await getHtmlRows());
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(processedHtml);
        } catch (err) {
            console.error(err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error loading index.html');
        }
    }
    else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Route not found');
    }
}

// Create and start server
const server = http.createServer(handleRequest);
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));