//
// ard-eventhub
// by SWR Audio Lab
//

// This helper runs the license-compliance toolkit using
// a pre-defined list of allowed licenses
//
// To make it runnable on your system,
// you might need to execute this command first:
// chmod +x license.sh
//

//
// --- EXCLUDE ---
//
// doctrine for undetected Apache-2.0 license (allowed)
// hdr-histogram-js for undetected BSD-2 license (allowed)
// spdx-exceptions due to CC license (excluded in README)
//

//
// --- ALLOW ---
//
// The list of allowed licenses was copied from
// https://joinup.ec.europa.eu/collection/eupl/matrix-eupl-compatible-open-source-licences
// as of February 25th, 2021
//
// 0BSD added since copy of ISC
// https://opensource.org/licenses/0BSD
//
// CC0-1.0 added as it looks compatible and credit to sources is given
// https://creativecommons.org/publicdomain/zero/1.0/
//

//
// --- RESULT ---
//
// If any of the direct dependencies used in this project is not compliant
// with the list of allowed licenses, the script will print them as a list.
// If all licenses are compliant, the script will exit silently.
//

module.exports = {
	allow: [
		'AFL-3.0',
		'APL-1.0',
		'Apache-2.0',
		'APSL-2.0',
		'Artistic-2.0',
		'AAL',
		'BSL-1.0',
		'BSD-2-Clause',
		'BSD-3-Clause',
		'CATOSL-1.1',
		'CDDL-1.0',
		'CPAL-1.0',
		'CUA-OPL-1.0',
		'EPL-1.0',
		'ECL-2.0',
		'EFL-2.0',
		'Entessa',
		'EUDatagrid',
		'EUPL-1.1',
		'EUPL-1.2',
		'Fair',
		'Frameworx-1.0',
		'LGPL-2.1',
		'LGPL-3.0',
		'IPL-1.0',
		'ISC',
		'LPPL-1.3c',
		'LPL-1.02',
		'MS-PL',
		'MS-RL',
		'MirOS',
		'MIT',
		'Motosoto',
		'MPL-1.1',
		'Multics',
		'NASA-1.3',
		'NTP',
		'Naumen',
		'OFL-1.1',
		'OGTSL',
		'PHP-3.0',
		'PostgreSQL',
		'Python-2.0',
		'QPL-1.0',
		'RPSL-1.0',
		'RSCPL',
		'SimPL-2.0',
		'Sleepycat',
		'SPL-1.0',
		'Watcom-1.0',
		'NCSA',
		'VSL-1.0',
		'W3C',
		'Xnet',
		'ZPL-2.0',
		'Zlib',
		'0BSD',
		'CC0-1.0',
	],
	exclude: ['@std/ulid', 'doctrine', 'hdr-histogram-js', 'spdx-exceptions'],
	direct: true,
	format: 'text',
	report: 'summary',
}
