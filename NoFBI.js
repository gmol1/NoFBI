#!/usr/bin/env node

const net = require('net'),
	fs = require('fs');

const conn = {
	port: 5000,
	host: process.argv[2]
};

var cias = process.argv.slice(3),
	completed = 0;

if (!conn.host || !cias.length) {
	console.log(
		'Usage: NoFBI.js IP file1 file2 ...' + '\n\n' + 
		'  e.g: NoFBI.js 192.168.1.5 CHMM2.cia');
	process.exit(1);
}

const client = new net.connect(conn, () => {
	const buffer = Buffer.allocUnsafe(4);
	buffer.fill(0);
	buffer.writeUInt32BE(cias.length, 0);
	console.log('Connected, waiting for FBI response...\n');
	client.write(buffer);
});

client.on('data', (data) => {
	const
		size = fs.statSync(cias[0]).size,
		buffer = new Buffer(8),
		MAX_UINT32 = 0xFFFFFFFF,
		big = ~~(size / MAX_UINT32),
		low = (size % MAX_UINT32) - big;

	var stream = fs.createReadStream(cias[0]),
		cia = formatFile(cias[0]),
		remaining = size,
		percent = 0,
		bytes = 0,
		time = process.hrtime();

	buffer.fill(0);
	buffer.writeUInt32BE(big, 0);
	buffer.writeUInt32BE(low, 4);
	client.write(buffer);
	stream.pipe(client, {end: false});

	stream
		.on('data', (data) => {
			if (client.destroyed === true) stream.destroy();
			process.stdout.clearLine();
			process.stdout.cursorTo(0);

			remaining -= data.length;
			percent += data.length * 100 / size;
			bytes += data.length;

			var diff = process.hrtime(time),
			speed = toMiB(bytes / (diff[0] * 1e9 + diff[1]) * 1e9),
			eta = formatETA(Math.floor(toMiB(remaining) / speed));

			if (remaining === 0) eta = 'Complete';

			process.stdout.write(
				cia + 
				' (' + toMiB(bytes) + ' MiB' + '/' + toMiB(size) + ' MiB' + ') ' + 
				Math.round(percent).toString() + '% ' + 
				speed + ' Mb/s' + 
				' [' + eta + ']');
		})
		.on('end', () => {
			cias.shift();
			console.log(' [ %d / %d ]', (process.argv.slice(3).length - cias.length), process.argv.slice(3).length);
			if (!cias.length) client.end();
		});
});

client.on('finish', () => {
	client.destroy();
});

client.on('close', () => {
	console.log('\nConnection closed');
});

client.on('error', (err) => {
	client.destroy();
});

function formatFile(cia) {
	buf = (cia.lastIndexOf('/')) ? cia.lastIndexOf('/') : cia.lastIndexOf('\\');
	return cia.substr(buf + 1);
}

function toMiB(bytes) {
	MiB = 9.5367431640625e-07;
	return (bytes * MiB).toFixed(2);
}

function formatETA(time) {
	var min = "0" + Math.floor(time / 60);
	var sec = "0" + (time - min * 60);
	return min.substr(-2) + ":" + sec.substr(-2);
}