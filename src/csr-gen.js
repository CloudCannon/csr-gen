var s = require('child_process').spawn;
var fs = require('fs');
var os = require('os');

const log = (a) => {
	if(process.env.VERBOSE) console.log('csr-gen: '+a);
}

var createSubjectString = function(options) {

	var subj =
		'/C='+options.country+
		'/ST='+options.state+
		'/L='+options.city+
		'/O='+options.company+
		'/OU='+options.division+
		'/CN='+options.domain+
		'/emailAddress='+options.email;
	
	return subj;
};

module.exports = function(domains, options, callback){
	const domain = domains[0];
	let altDomains = [];
	if (domains.length > 1)
	{
		altDomains = domains.slice(1);
	}

	callback || (callback = function(){});

	options || (options = {});
	if(!options.outputDir) options.outputDir = os.tmpdir();
	if(!options.outputDir.endsWith('/')) options.outputDir += '/';
	if(!options.company) options.company = domain;
	if(!options.country) options.country = 'US';
	if(!options.state) options.state = 'California';
	if(!options.city) options.city = 'San Fransisco';
	if(!options.division) options.division = 'Operations';
	if(!options.email) options.email = '';
	if(!options.password) options.password = '';
	if(!options.keyName) options.keyName = domain+'.key';
	if(!options.csrName) options.csrName = domain+'.csr';

	// Needed to generate subject string
	options.domain = domain;

	var keyPath = options.outputDir+options.keyName;
	var csrPath = options.outputDir+options.csrName;

	var read = options.read;
	var destroy = options.destroy;

	var subj = createSubjectString(options);

	log("Subj: " + subj);

	var opts = [
		'req',
		'-newkey','rsa:2048',
		'-keyout', keyPath,
		'-out', csrPath,
		'-subj', subj
	];
	
	if (altDomains.length > 0)
	{
		opts.push('-addext', `subjectAltName = ${altDomains.map(el => `DNS:${el}`).join(',')}`)
	}

	var passFile = options.password != '' ? "pass.txt" : false;

	if (passFile) {
		fs.writeFile(passFile, options.password, function(err) {
			if(err) {
				log("Error saving password to temp file: " + err);
			}
		});
		opts.push('-passout');
		opts.push('file:'+passFile);
	} else {
		opts.push('-nodes');
	}

	var openssl = s('openssl', opts);

	function inputText(a){
		log('writing: '+a)
		openssl.stdin.write(a+'\n');
	}

	openssl.stdout.on('data', function(a){
		log('stdout:'+a);
	});

	openssl.on('exit',function(){
		if(passFile) fs.unlink(passFile);
		log('exited');
		if(read){
			fs.readFile(keyPath, {encoding: 'utf8'}, function(err, key){
				if(destroy) fs.unlink(keyPath, function(err){
					if(err) return callback(err);
					readCSR();
				});
				else readCSR();
				function readCSR(){
					fs.readFile(csrPath, {encoding: 'utf8'}, function(err, csr){
						if(destroy) fs.unlink(csrPath, function(err){
							if(err) return callback(err);
							return callback(undefined, { key: key, csr: csr });
						});
						else callback(undefined, { key: key, csr: csr });
					});
				}
			});
		} else callback(undefined, {});
	});

	openssl.stderr.on('data',function(line){
		line = line.toString('utf8').trim();
		if (line && line != '.' && line != '+' && line != '-----')
			log('openssl: ' + line);
	});
};
