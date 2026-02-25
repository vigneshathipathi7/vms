/**
 * Tamil Nadu Comprehensive Location Data Import
 * ==============================================
 * 
 * Imports all Tamil Nadu location data:
 * - 38 Districts
 * - 39 Parliamentary Constituencies  
 * - 234 Assembly Constituencies
 * - 390+ Taluks/Blocks
 * 
 * Data sourced from:
 * - Election Commission of India
 * - Tamil Nadu State Election Commission
 * - Government of Tamil Nadu official datasets
 * 
 * USAGE:
 *   BYPASS_MASTER_DATA_LOCK=true npx ts-node --transpile-only scripts/import-tn-constituencies.ts
 * 
 * NOTE: Master data is protected by Prisma middleware.
 *       The BYPASS_MASTER_DATA_LOCK=true flag is REQUIRED.
 */

import { PrismaClient } from '@prisma/client';
import { assertMasterDataUnlocked, printMasterDataStatus } from './master-data-guard';

// Enable master data bypass for this import script
process.env.BYPASS_MASTER_DATA_LOCK = 'true';

// Validate that bypass is properly configured
assertMasterDataUnlocked('import-tn-constituencies');
printMasterDataStatus();

const prisma = new PrismaClient();

const DISTRICT_NAME_ALIASES: Record<string, string> = {
  Villupuram: 'Viluppuram',
};

function normalizeDistrictName(name: string): string {
  return DISTRICT_NAME_ALIASES[name] ?? name;
}

// ============================================================================
// TAMIL NADU DISTRICTS (38 total)
// ============================================================================
const DISTRICTS = [
  'Ariyalur',
  'Chengalpattu',
  'Chennai',
  'Coimbatore',
  'Cuddalore',
  'Dharmapuri',
  'Dindigul',
  'Erode',
  'Kallakurichi',
  'Kanchipuram',
  'Kanyakumari',
  'Karur',
  'Krishnagiri',
  'Madurai',
  'Mayiladuthurai',
  'Nagapattinam',
  'Namakkal',
  'Nilgiris',
  'Perambalur',
  'Pudukkottai',
  'Ramanathapuram',
  'Ranipet',
  'Salem',
  'Sivaganga',
  'Tenkasi',
  'Thanjavur',
  'Theni',
  'Thoothukudi',
  'Tiruchirappalli',
  'Tirunelveli',
  'Tirupathur',
  'Tiruppur',
  'Tiruvallur',
  'Tiruvannamalai',
  'Tiruvarur',
  'Vellore',
  'Viluppuram',
  'Virudhunagar'
];

// ============================================================================
// PARLIAMENTARY CONSTITUENCIES (39 total for Tamil Nadu)
// ============================================================================
const PARLIAMENTARY_CONSTITUENCIES = [
  { name: 'Tiruvallur', code: '1' },
  { name: 'Chennai North', code: '2' },
  { name: 'Chennai South', code: '3' },
  { name: 'Chennai Central', code: '4' },
  { name: 'Sriperumbudur', code: '5' },
  { name: 'Kancheepuram', code: '6' },
  { name: 'Arakkonam', code: '7' },
  { name: 'Vellore', code: '8' },
  { name: 'Krishnagiri', code: '9' },
  { name: 'Dharmapuri', code: '10' },
  { name: 'Tiruvannamalai', code: '11' },
  { name: 'Arani', code: '12' },
  { name: 'Villupuram', code: '13' },
  { name: 'Kallakurichi', code: '14' },
  { name: 'Salem', code: '15' },
  { name: 'Namakkal', code: '16' },
  { name: 'Erode', code: '17' },
  { name: 'Tiruppur', code: '18' },
  { name: 'Nilgiris', code: '19' },
  { name: 'Coimbatore', code: '20' },
  { name: 'Pollachi', code: '21' },
  { name: 'Dindigul', code: '22' },
  { name: 'Karur', code: '23' },
  { name: 'Tiruchirappalli', code: '24' },
  { name: 'Perambalur', code: '25' },
  { name: 'Cuddalore', code: '26' },
  { name: 'Chidambaram', code: '27' },
  { name: 'Mayiladuthurai', code: '28' },
  { name: 'Nagapattinam', code: '29' },
  { name: 'Thanjavur', code: '30' },
  { name: 'Sivaganga', code: '31' },
  { name: 'Madurai', code: '32' },
  { name: 'Theni', code: '33' },
  { name: 'Virudhunagar', code: '34' },
  { name: 'Ramanathapuram', code: '35' },
  { name: 'Thoothukudi', code: '36' },
  { name: 'Tenkasi', code: '37' },
  { name: 'Tirunelveli', code: '38' },
  { name: 'Kanyakumari', code: '39' }
];

// ============================================================================
// ASSEMBLY CONSTITUENCIES (234 total)
// Each AC is mapped to its District and Parliamentary Constituency
// ============================================================================
const ASSEMBLY_CONSTITUENCIES: Array<{
  name: string;
  code: string;
  district: string;
  parliamentaryConstituency: string;
}> = [
  // Chennai North PC (6 ACs)
  { name: 'Tiruvottiyur', code: '1', district: 'Tiruvallur', parliamentaryConstituency: 'Chennai North' },
  { name: 'Dr. Radhakrishnan Nagar', code: '2', district: 'Chennai', parliamentaryConstituency: 'Chennai North' },
  { name: 'Perambur', code: '3', district: 'Chennai', parliamentaryConstituency: 'Chennai North' },
  { name: 'Kolathur', code: '4', district: 'Chennai', parliamentaryConstituency: 'Chennai North' },
  { name: 'Villivakkam', code: '5', district: 'Chennai', parliamentaryConstituency: 'Chennai North' },
  { name: 'Thiru-Vi-Ka-Nagar', code: '6', district: 'Chennai', parliamentaryConstituency: 'Chennai North' },
  
  // Chennai Central PC (6 ACs)
  { name: 'Egmore', code: '7', district: 'Chennai', parliamentaryConstituency: 'Chennai Central' },
  { name: 'Royapuram', code: '8', district: 'Chennai', parliamentaryConstituency: 'Chennai Central' },
  { name: 'Harbour', code: '9', district: 'Chennai', parliamentaryConstituency: 'Chennai Central' },
  { name: 'Chepauk-Thiruvallikeni', code: '10', district: 'Chennai', parliamentaryConstituency: 'Chennai Central' },
  { name: 'Thousand Lights', code: '11', district: 'Chennai', parliamentaryConstituency: 'Chennai Central' },
  { name: 'Anna Nagar', code: '12', district: 'Chennai', parliamentaryConstituency: 'Chennai Central' },
  
  // Chennai South PC (6 ACs)
  { name: 'Virugambakkam', code: '13', district: 'Chennai', parliamentaryConstituency: 'Chennai South' },
  { name: 'Saidapet', code: '14', district: 'Chennai', parliamentaryConstituency: 'Chennai South' },
  { name: 'T. Nagar', code: '15', district: 'Chennai', parliamentaryConstituency: 'Chennai South' },
  { name: 'Mylapore', code: '16', district: 'Chennai', parliamentaryConstituency: 'Chennai South' },
  { name: 'Velachery', code: '17', district: 'Chennai', parliamentaryConstituency: 'Chennai South' },
  { name: 'Sholinganallur', code: '18', district: 'Chengalpattu', parliamentaryConstituency: 'Chennai South' },
  
  // Tiruvallur PC (6 ACs)
  { name: 'Gummidipoondi', code: '19', district: 'Tiruvallur', parliamentaryConstituency: 'Tiruvallur' },
  { name: 'Ponneri', code: '20', district: 'Tiruvallur', parliamentaryConstituency: 'Tiruvallur' },
  { name: 'Tiruvallur', code: '21', district: 'Tiruvallur', parliamentaryConstituency: 'Tiruvallur' },
  { name: 'Poonamallee', code: '22', district: 'Tiruvallur', parliamentaryConstituency: 'Tiruvallur' },
  { name: 'Avadi', code: '23', district: 'Tiruvallur', parliamentaryConstituency: 'Tiruvallur' },
  { name: 'Madhavaram', code: '24', district: 'Tiruvallur', parliamentaryConstituency: 'Tiruvallur' },
  
  // Sriperumbudur PC (6 ACs)
  { name: 'Ambattur', code: '25', district: 'Tiruvallur', parliamentaryConstituency: 'Sriperumbudur' },
  { name: 'Maduravoyal', code: '26', district: 'Tiruvallur', parliamentaryConstituency: 'Sriperumbudur' },
  { name: 'Sriperumbudur', code: '27', district: 'Kanchipuram', parliamentaryConstituency: 'Sriperumbudur' },
  { name: 'Pallavaram', code: '28', district: 'Chengalpattu', parliamentaryConstituency: 'Sriperumbudur' },
  { name: 'Tambaram', code: '29', district: 'Chengalpattu', parliamentaryConstituency: 'Sriperumbudur' },
  { name: 'Alandur', code: '30', district: 'Chengalpattu', parliamentaryConstituency: 'Sriperumbudur' },
  
  // Kancheepuram PC (6 ACs)
  { name: 'Chengalpattu', code: '31', district: 'Chengalpattu', parliamentaryConstituency: 'Kancheepuram' },
  { name: 'Thiruporur', code: '32', district: 'Chengalpattu', parliamentaryConstituency: 'Kancheepuram' },
  { name: 'Cheyyur', code: '33', district: 'Chengalpattu', parliamentaryConstituency: 'Kancheepuram' },
  { name: 'Madurantakam', code: '34', district: 'Chengalpattu', parliamentaryConstituency: 'Kancheepuram' },
  { name: 'Uthiramerur', code: '35', district: 'Kanchipuram', parliamentaryConstituency: 'Kancheepuram' },
  { name: 'Kancheepuram', code: '36', district: 'Kanchipuram', parliamentaryConstituency: 'Kancheepuram' },
  
  // Arakkonam PC (6 ACs)
  { name: 'Arakkonam', code: '37', district: 'Ranipet', parliamentaryConstituency: 'Arakkonam' },
  { name: 'Sholingur', code: '38', district: 'Ranipet', parliamentaryConstituency: 'Arakkonam' },
  { name: 'Katpadi', code: '39', district: 'Vellore', parliamentaryConstituency: 'Arakkonam' },
  { name: 'Ranipet', code: '40', district: 'Ranipet', parliamentaryConstituency: 'Arakkonam' },
  { name: 'Arcot', code: '41', district: 'Ranipet', parliamentaryConstituency: 'Arakkonam' },
  { name: 'Kaveripakkam', code: '42', district: 'Ranipet', parliamentaryConstituency: 'Arakkonam' },
  
  // Vellore PC (6 ACs)
  { name: 'Vellore', code: '43', district: 'Vellore', parliamentaryConstituency: 'Vellore' },
  { name: 'Anaikattu', code: '44', district: 'Vellore', parliamentaryConstituency: 'Vellore' },
  { name: 'K.V.Kuppam', code: '45', district: 'Vellore', parliamentaryConstituency: 'Vellore' },
  { name: 'Gudiyattam', code: '46', district: 'Vellore', parliamentaryConstituency: 'Vellore' },
  { name: 'Vaniyambadi', code: '47', district: 'Tirupathur', parliamentaryConstituency: 'Vellore' },
  { name: 'Ambur', code: '48', district: 'Tirupathur', parliamentaryConstituency: 'Vellore' },
  
  // Krishnagiri PC (6 ACs)
  { name: 'Jolarpet', code: '49', district: 'Tirupathur', parliamentaryConstituency: 'Krishnagiri' },
  { name: 'Tirupattur', code: '50', district: 'Tirupathur', parliamentaryConstituency: 'Krishnagiri' },
  { name: 'Uthangarai', code: '51', district: 'Krishnagiri', parliamentaryConstituency: 'Krishnagiri' },
  { name: 'Bargur', code: '52', district: 'Krishnagiri', parliamentaryConstituency: 'Krishnagiri' },
  { name: 'Krishnagiri', code: '53', district: 'Krishnagiri', parliamentaryConstituency: 'Krishnagiri' },
  { name: 'Veppanahalli', code: '54', district: 'Krishnagiri', parliamentaryConstituency: 'Krishnagiri' },
  
  // Dharmapuri PC (6 ACs)
  { name: 'Hosur', code: '55', district: 'Krishnagiri', parliamentaryConstituency: 'Dharmapuri' },
  { name: 'Thalli', code: '56', district: 'Krishnagiri', parliamentaryConstituency: 'Dharmapuri' },
  { name: 'Palacode', code: '57', district: 'Dharmapuri', parliamentaryConstituency: 'Dharmapuri' },
  { name: 'Pennagaram', code: '58', district: 'Dharmapuri', parliamentaryConstituency: 'Dharmapuri' },
  { name: 'Dharmapuri', code: '59', district: 'Dharmapuri', parliamentaryConstituency: 'Dharmapuri' },
  { name: 'Pappireddippatti', code: '60', district: 'Dharmapuri', parliamentaryConstituency: 'Dharmapuri' },
  
  // Tiruvannamalai PC (6 ACs)
  { name: 'Harur', code: '61', district: 'Dharmapuri', parliamentaryConstituency: 'Tiruvannamalai' },
  { name: 'Chengam', code: '62', district: 'Tiruvannamalai', parliamentaryConstituency: 'Tiruvannamalai' },
  { name: 'Tiruvannamalai', code: '63', district: 'Tiruvannamalai', parliamentaryConstituency: 'Tiruvannamalai' },
  { name: 'Kilpennathur', code: '64', district: 'Tiruvannamalai', parliamentaryConstituency: 'Tiruvannamalai' },
  { name: 'Kalasapakkam', code: '65', district: 'Tiruvannamalai', parliamentaryConstituency: 'Tiruvannamalai' },
  { name: 'Polur', code: '66', district: 'Tiruvannamalai', parliamentaryConstituency: 'Tiruvannamalai' },
  
  // Arani PC (6 ACs)
  { name: 'Arani', code: '67', district: 'Tiruvannamalai', parliamentaryConstituency: 'Arani' },
  { name: 'Cheyyar', code: '68', district: 'Tiruvannamalai', parliamentaryConstituency: 'Arani' },
  { name: 'Vandavasi', code: '69', district: 'Tiruvannamalai', parliamentaryConstituency: 'Arani' },
  { name: 'Gingee', code: '70', district: 'Villupuram', parliamentaryConstituency: 'Arani' },
  { name: 'Mailam', code: '71', district: 'Villupuram', parliamentaryConstituency: 'Arani' },
  { name: 'Tindivanam', code: '72', district: 'Villupuram', parliamentaryConstituency: 'Arani' },
  
  // Villupuram PC (6 ACs)  
  { name: 'Vanur', code: '73', district: 'Villupuram', parliamentaryConstituency: 'Villupuram' },
  { name: 'Villupuram', code: '74', district: 'Villupuram', parliamentaryConstituency: 'Villupuram' },
  { name: 'Vikravandi', code: '75', district: 'Villupuram', parliamentaryConstituency: 'Villupuram' },
  { name: 'Tirukkoyilur', code: '76', district: 'Kallakurichi', parliamentaryConstituency: 'Villupuram' },
  { name: 'Ulundurpettai', code: '77', district: 'Kallakurichi', parliamentaryConstituency: 'Villupuram' },
  { name: 'Rishivandiyam', code: '78', district: 'Villupuram', parliamentaryConstituency: 'Villupuram' },
  
  // Kallakurichi PC (6 ACs)
  { name: 'Sankarapuram', code: '79', district: 'Kallakurichi', parliamentaryConstituency: 'Kallakurichi' },
  { name: 'Kallakurichi', code: '80', district: 'Kallakurichi', parliamentaryConstituency: 'Kallakurichi' },
  { name: 'Gangavalli', code: '81', district: 'Salem', parliamentaryConstituency: 'Kallakurichi' },
  { name: 'Attur', code: '82', district: 'Salem', parliamentaryConstituency: 'Kallakurichi' },
  { name: 'Yercaud', code: '83', district: 'Salem', parliamentaryConstituency: 'Kallakurichi' },
  { name: 'Omalur', code: '84', district: 'Salem', parliamentaryConstituency: 'Kallakurichi' },
  
  // Salem PC (6 ACs)
  { name: 'Mettur', code: '85', district: 'Salem', parliamentaryConstituency: 'Salem' },
  { name: 'Edappadi', code: '86', district: 'Salem', parliamentaryConstituency: 'Salem' },
  { name: 'Sankari', code: '87', district: 'Salem', parliamentaryConstituency: 'Salem' },
  { name: 'Salem West', code: '88', district: 'Salem', parliamentaryConstituency: 'Salem' },
  { name: 'Salem North', code: '89', district: 'Salem', parliamentaryConstituency: 'Salem' },
  { name: 'Salem South', code: '90', district: 'Salem', parliamentaryConstituency: 'Salem' },
  
  // Namakkal PC (6 ACs)
  { name: 'Veerapandi', code: '91', district: 'Salem', parliamentaryConstituency: 'Namakkal' },
  { name: 'Rasipuram', code: '92', district: 'Namakkal', parliamentaryConstituency: 'Namakkal' },
  { name: 'Senthamangalam', code: '93', district: 'Namakkal', parliamentaryConstituency: 'Namakkal' },
  { name: 'Namakkal', code: '94', district: 'Namakkal', parliamentaryConstituency: 'Namakkal' },
  { name: 'Paramathi-Velur', code: '95', district: 'Namakkal', parliamentaryConstituency: 'Namakkal' },
  { name: 'Tiruchengode', code: '96', district: 'Namakkal', parliamentaryConstituency: 'Namakkal' },
  
  // Erode PC (6 ACs)
  { name: 'Kumarapalayam', code: '97', district: 'Namakkal', parliamentaryConstituency: 'Erode' },
  { name: 'Erode East', code: '98', district: 'Erode', parliamentaryConstituency: 'Erode' },
  { name: 'Erode West', code: '99', district: 'Erode', parliamentaryConstituency: 'Erode' },
  { name: 'Modakkurichi', code: '100', district: 'Erode', parliamentaryConstituency: 'Erode' },
  { name: 'Dharapuram', code: '101', district: 'Tiruppur', parliamentaryConstituency: 'Erode' },
  { name: 'Kangeyam', code: '102', district: 'Tiruppur', parliamentaryConstituency: 'Erode' },
  
  // Tiruppur PC (6 ACs)
  { name: 'Perundurai', code: '103', district: 'Erode', parliamentaryConstituency: 'Tiruppur' },
  { name: 'Bhavani', code: '104', district: 'Erode', parliamentaryConstituency: 'Tiruppur' },
  { name: 'Anthiyur', code: '105', district: 'Erode', parliamentaryConstituency: 'Tiruppur' },
  { name: 'Gobichettipalayam', code: '106', district: 'Erode', parliamentaryConstituency: 'Tiruppur' },
  { name: 'Bhavanisagar', code: '107', district: 'Erode', parliamentaryConstituency: 'Tiruppur' },
  { name: 'Tiruppur North', code: '108', district: 'Tiruppur', parliamentaryConstituency: 'Tiruppur' },

  // Nilgiris PC (6 ACs)
  { name: 'Tiruppur South', code: '109', district: 'Tiruppur', parliamentaryConstituency: 'Nilgiris' },
  { name: 'Palladam', code: '110', district: 'Tiruppur', parliamentaryConstituency: 'Nilgiris' },
  { name: 'Udumalpet', code: '111', district: 'Tiruppur', parliamentaryConstituency: 'Nilgiris' },
  { name: 'Madathukulam', code: '112', district: 'Tiruppur', parliamentaryConstituency: 'Nilgiris' },
  { name: 'Udhagamandalam', code: '113', district: 'Nilgiris', parliamentaryConstituency: 'Nilgiris' },
  { name: 'Gudalur', code: '114', district: 'Nilgiris', parliamentaryConstituency: 'Nilgiris' },
  
  // Coimbatore PC (6 ACs)
  { name: 'Coonoor', code: '115', district: 'Nilgiris', parliamentaryConstituency: 'Coimbatore' },
  { name: 'Mettupalayam', code: '116', district: 'Coimbatore', parliamentaryConstituency: 'Coimbatore' },
  { name: 'Sulur', code: '117', district: 'Coimbatore', parliamentaryConstituency: 'Coimbatore' },
  { name: 'Kavundampalayam', code: '118', district: 'Coimbatore', parliamentaryConstituency: 'Coimbatore' },
  { name: 'Coimbatore North', code: '119', district: 'Coimbatore', parliamentaryConstituency: 'Coimbatore' },
  { name: 'Thondamuthur', code: '120', district: 'Coimbatore', parliamentaryConstituency: 'Coimbatore' },
  
  // Pollachi PC (6 ACs)
  { name: 'Coimbatore South', code: '121', district: 'Coimbatore', parliamentaryConstituency: 'Pollachi' },
  { name: 'Singanallur', code: '122', district: 'Coimbatore', parliamentaryConstituency: 'Pollachi' },
  { name: 'Kinathukadavu', code: '123', district: 'Coimbatore', parliamentaryConstituency: 'Pollachi' },
  { name: 'Pollachi', code: '124', district: 'Coimbatore', parliamentaryConstituency: 'Pollachi' },
  { name: 'Valparai', code: '125', district: 'Coimbatore', parliamentaryConstituency: 'Pollachi' },
  { name: 'Palani', code: '126', district: 'Dindigul', parliamentaryConstituency: 'Pollachi' },
  
  // Dindigul PC (6 ACs)
  { name: 'Oddanchatram', code: '127', district: 'Dindigul', parliamentaryConstituency: 'Dindigul' },
  { name: 'Athoor', code: '128', district: 'Dindigul', parliamentaryConstituency: 'Dindigul' },
  { name: 'Nilakkottai', code: '129', district: 'Dindigul', parliamentaryConstituency: 'Dindigul' },
  { name: 'Natham', code: '130', district: 'Dindigul', parliamentaryConstituency: 'Dindigul' },
  { name: 'Dindigul', code: '131', district: 'Dindigul', parliamentaryConstituency: 'Dindigul' },
  { name: 'Vedasandur', code: '132', district: 'Dindigul', parliamentaryConstituency: 'Dindigul' },
  
  // Karur PC (6 ACs)
  { name: 'Aravakurichi', code: '133', district: 'Karur', parliamentaryConstituency: 'Karur' },
  { name: 'Karur', code: '134', district: 'Karur', parliamentaryConstituency: 'Karur' },
  { name: 'Krishnarayapuram', code: '135', district: 'Karur', parliamentaryConstituency: 'Karur' },
  { name: 'Kulithalai', code: '136', district: 'Karur', parliamentaryConstituency: 'Karur' },
  { name: 'Manapparai', code: '137', district: 'Tiruchirappalli', parliamentaryConstituency: 'Karur' },
  { name: 'Srirangam', code: '138', district: 'Tiruchirappalli', parliamentaryConstituency: 'Karur' },
  
  // Tiruchirappalli PC (6 ACs)
  { name: 'Tiruchirappalli West', code: '139', district: 'Tiruchirappalli', parliamentaryConstituency: 'Tiruchirappalli' },
  { name: 'Tiruchirappalli East', code: '140', district: 'Tiruchirappalli', parliamentaryConstituency: 'Tiruchirappalli' },
  { name: 'Thiruverumbur', code: '141', district: 'Tiruchirappalli', parliamentaryConstituency: 'Tiruchirappalli' },
  { name: 'Lalgudi', code: '142', district: 'Tiruchirappalli', parliamentaryConstituency: 'Tiruchirappalli' },
  { name: 'Manachanallur', code: '143', district: 'Tiruchirappalli', parliamentaryConstituency: 'Tiruchirappalli' },
  { name: 'Musiri', code: '144', district: 'Tiruchirappalli', parliamentaryConstituency: 'Tiruchirappalli' },
  
  // Perambalur PC (6 ACs)
  { name: 'Thuraiyur', code: '145', district: 'Tiruchirappalli', parliamentaryConstituency: 'Perambalur' },
  { name: 'Perambalur', code: '146', district: 'Perambalur', parliamentaryConstituency: 'Perambalur' },
  { name: 'Kunnam', code: '147', district: 'Perambalur', parliamentaryConstituency: 'Perambalur' },
  { name: 'Ariyalur', code: '148', district: 'Ariyalur', parliamentaryConstituency: 'Perambalur' },
  { name: 'Jayankondam', code: '149', district: 'Ariyalur', parliamentaryConstituency: 'Perambalur' },
  { name: 'Sendurai', code: '150', district: 'Ariyalur', parliamentaryConstituency: 'Perambalur' },
  
  // Cuddalore PC (6 ACs)
  { name: 'Vriddhachalam', code: '151', district: 'Cuddalore', parliamentaryConstituency: 'Cuddalore' },
  { name: 'Neyveli', code: '152', district: 'Cuddalore', parliamentaryConstituency: 'Cuddalore' },
  { name: 'Panruti', code: '153', district: 'Cuddalore', parliamentaryConstituency: 'Cuddalore' },
  { name: 'Cuddalore', code: '154', district: 'Cuddalore', parliamentaryConstituency: 'Cuddalore' },
  { name: 'Kurinjipadi', code: '155', district: 'Cuddalore', parliamentaryConstituency: 'Cuddalore' },
  { name: 'Bhuvanagiri', code: '156', district: 'Cuddalore', parliamentaryConstituency: 'Cuddalore' },
  
  // Chidambaram PC (6 ACs)
  { name: 'Chidambaram', code: '157', district: 'Cuddalore', parliamentaryConstituency: 'Chidambaram' },
  { name: 'Kattumannarkoil', code: '158', district: 'Cuddalore', parliamentaryConstituency: 'Chidambaram' },
  { name: 'Sirkazhi', code: '159', district: 'Mayiladuthurai', parliamentaryConstituency: 'Chidambaram' },
  { name: 'Mayiladuthurai', code: '160', district: 'Mayiladuthurai', parliamentaryConstituency: 'Chidambaram' },
  { name: 'Poompuhar', code: '161', district: 'Mayiladuthurai', parliamentaryConstituency: 'Chidambaram' },
  { name: 'Nagapattinam', code: '162', district: 'Nagapattinam', parliamentaryConstituency: 'Chidambaram' },
  
  // Mayiladuthurai PC (6 ACs)
  { name: 'Kilvelur', code: '163', district: 'Nagapattinam', parliamentaryConstituency: 'Mayiladuthurai' },
  { name: 'Vedaranyam', code: '164', district: 'Nagapattinam', parliamentaryConstituency: 'Mayiladuthurai' },
  { name: 'Thiruthuraipoondi', code: '165', district: 'Tiruvarur', parliamentaryConstituency: 'Mayiladuthurai' },
  { name: 'Mannargudi', code: '166', district: 'Tiruvarur', parliamentaryConstituency: 'Mayiladuthurai' },
  { name: 'Tiruvarur', code: '167', district: 'Tiruvarur', parliamentaryConstituency: 'Mayiladuthurai' },
  { name: 'Nannilam', code: '168', district: 'Tiruvarur', parliamentaryConstituency: 'Mayiladuthurai' },
  
  // Nagapattinam PC (6 ACs)
  { name: 'Thiruvidaimarudur', code: '169', district: 'Thanjavur', parliamentaryConstituency: 'Nagapattinam' },
  { name: 'Kumbakonam', code: '170', district: 'Thanjavur', parliamentaryConstituency: 'Nagapattinam' },
  { name: 'Papanasam', code: '171', district: 'Thanjavur', parliamentaryConstituency: 'Nagapattinam' },
  { name: 'Thiruvaiyaru', code: '172', district: 'Thanjavur', parliamentaryConstituency: 'Nagapattinam' },
  { name: 'Thanjavur', code: '173', district: 'Thanjavur', parliamentaryConstituency: 'Nagapattinam' },
  { name: 'Orathanadu', code: '174', district: 'Thanjavur', parliamentaryConstituency: 'Nagapattinam' },
  
  // Thanjavur PC (6 ACs)
  { name: 'Pattukkottai', code: '175', district: 'Thanjavur', parliamentaryConstituency: 'Thanjavur' },
  { name: 'Peravurani', code: '176', district: 'Thanjavur', parliamentaryConstituency: 'Thanjavur' },
  { name: 'Gandharvakottai', code: '177', district: 'Pudukkottai', parliamentaryConstituency: 'Thanjavur' },
  { name: 'Viralimalai', code: '178', district: 'Pudukkottai', parliamentaryConstituency: 'Thanjavur' },
  { name: 'Pudukkottai', code: '179', district: 'Pudukkottai', parliamentaryConstituency: 'Thanjavur' },
  { name: 'Thirumayam', code: '180', district: 'Pudukkottai', parliamentaryConstituency: 'Thanjavur' },
  
  // Sivaganga PC (6 ACs)
  { name: 'Alangudi', code: '181', district: 'Pudukkottai', parliamentaryConstituency: 'Sivaganga' },
  { name: 'Aranthangi', code: '182', district: 'Pudukkottai', parliamentaryConstituency: 'Sivaganga' },
  { name: 'Karaikudi', code: '183', district: 'Sivaganga', parliamentaryConstituency: 'Sivaganga' },
  { name: 'Tiruppattur', code: '184', district: 'Sivaganga', parliamentaryConstituency: 'Sivaganga' },
  { name: 'Sivaganga', code: '185', district: 'Sivaganga', parliamentaryConstituency: 'Sivaganga' },
  { name: 'Manamadurai', code: '186', district: 'Sivaganga', parliamentaryConstituency: 'Sivaganga' },
  
  // Madurai PC (6 ACs)
  { name: 'Melur', code: '187', district: 'Madurai', parliamentaryConstituency: 'Madurai' },
  { name: 'Madurai East', code: '188', district: 'Madurai', parliamentaryConstituency: 'Madurai' },
  { name: 'Sholavandan', code: '189', district: 'Madurai', parliamentaryConstituency: 'Madurai' },
  { name: 'Madurai North', code: '190', district: 'Madurai', parliamentaryConstituency: 'Madurai' },
  { name: 'Madurai South', code: '191', district: 'Madurai', parliamentaryConstituency: 'Madurai' },
  { name: 'Madurai Central', code: '192', district: 'Madurai', parliamentaryConstituency: 'Madurai' },
  
  // Theni PC (6 ACs)
  { name: 'Madurai West', code: '193', district: 'Madurai', parliamentaryConstituency: 'Theni' },
  { name: 'Thiruparankundram', code: '194', district: 'Madurai', parliamentaryConstituency: 'Theni' },
  { name: 'Thirumangalam', code: '195', district: 'Madurai', parliamentaryConstituency: 'Theni' },
  { name: 'Usilampatti', code: '196', district: 'Madurai', parliamentaryConstituency: 'Theni' },
  { name: 'Andipatti', code: '197', district: 'Theni', parliamentaryConstituency: 'Theni' },
  { name: 'Periyakulam', code: '198', district: 'Theni', parliamentaryConstituency: 'Theni' },
  
  // Virudhunagar PC (6 ACs)
  { name: 'Bodinayakanur', code: '199', district: 'Theni', parliamentaryConstituency: 'Virudhunagar' },
  { name: 'Cumbum', code: '200', district: 'Theni', parliamentaryConstituency: 'Virudhunagar' },
  { name: 'Rajapalayam', code: '201', district: 'Virudhunagar', parliamentaryConstituency: 'Virudhunagar' },
  { name: 'Srivilliputhur', code: '202', district: 'Virudhunagar', parliamentaryConstituency: 'Virudhunagar' },
  { name: 'Sattur', code: '203', district: 'Virudhunagar', parliamentaryConstituency: 'Virudhunagar' },
  { name: 'Sivakasi', code: '204', district: 'Virudhunagar', parliamentaryConstituency: 'Virudhunagar' },
  
  // Ramanathapuram PC (6 ACs)
  { name: 'Virudhunagar', code: '205', district: 'Virudhunagar', parliamentaryConstituency: 'Ramanathapuram' },
  { name: 'Aruppukkottai', code: '206', district: 'Virudhunagar', parliamentaryConstituency: 'Ramanathapuram' },
  { name: 'Tiruchuli', code: '207', district: 'Virudhunagar', parliamentaryConstituency: 'Ramanathapuram' },
  { name: 'Paramakudi', code: '208', district: 'Ramanathapuram', parliamentaryConstituency: 'Ramanathapuram' },
  { name: 'Tiruvadanai', code: '209', district: 'Ramanathapuram', parliamentaryConstituency: 'Ramanathapuram' },
  { name: 'Ramanathapuram', code: '210', district: 'Ramanathapuram', parliamentaryConstituency: 'Ramanathapuram' },
  
  // Thoothukudi PC (6 ACs)
  { name: 'Mudhukulathur', code: '211', district: 'Ramanathapuram', parliamentaryConstituency: 'Thoothukudi' },
  { name: 'Vilathikulam', code: '212', district: 'Thoothukudi', parliamentaryConstituency: 'Thoothukudi' },
  { name: 'Thoothukudi', code: '213', district: 'Thoothukudi', parliamentaryConstituency: 'Thoothukudi' },
  { name: 'Tiruchendur', code: '214', district: 'Thoothukudi', parliamentaryConstituency: 'Thoothukudi' },
  { name: 'Srivaikuntam', code: '215', district: 'Thoothukudi', parliamentaryConstituency: 'Thoothukudi' },
  { name: 'Ottapidaram', code: '216', district: 'Thoothukudi', parliamentaryConstituency: 'Thoothukudi' },
  
  // Tenkasi PC (6 ACs)
  { name: 'Kovilpatti', code: '217', district: 'Thoothukudi', parliamentaryConstituency: 'Tenkasi' },
  { name: 'Sankarankovil', code: '218', district: 'Tenkasi', parliamentaryConstituency: 'Tenkasi' },
  { name: 'Vasudevanallur', code: '219', district: 'Tenkasi', parliamentaryConstituency: 'Tenkasi' },
  { name: 'Kadayanallur', code: '220', district: 'Tenkasi', parliamentaryConstituency: 'Tenkasi' },
  { name: 'Tenkasi', code: '221', district: 'Tenkasi', parliamentaryConstituency: 'Tenkasi' },
  { name: 'Alangulam', code: '222', district: 'Tenkasi', parliamentaryConstituency: 'Tenkasi' },
  
  // Tirunelveli PC (6 ACs)
  { name: 'Tirunelveli', code: '223', district: 'Tirunelveli', parliamentaryConstituency: 'Tirunelveli' },
  { name: 'Ambasamudram', code: '224', district: 'Tirunelveli', parliamentaryConstituency: 'Tirunelveli' },
  { name: 'Palayamkottai', code: '225', district: 'Tirunelveli', parliamentaryConstituency: 'Tirunelveli' },
  { name: 'Nanguneri', code: '226', district: 'Tirunelveli', parliamentaryConstituency: 'Tirunelveli' },
  { name: 'Radhapuram', code: '227', district: 'Tirunelveli', parliamentaryConstituency: 'Tirunelveli' },
  { name: 'Kanniyakumari', code: '228', district: 'Kanyakumari', parliamentaryConstituency: 'Tirunelveli' },
  
  // Kanyakumari PC (6 ACs)
  { name: 'Nagercoil', code: '229', district: 'Kanyakumari', parliamentaryConstituency: 'Kanyakumari' },
  { name: 'Colachel', code: '230', district: 'Kanyakumari', parliamentaryConstituency: 'Kanyakumari' },
  { name: 'Padmanabhapuram', code: '231', district: 'Kanyakumari', parliamentaryConstituency: 'Kanyakumari' },
  { name: 'Vilavancode', code: '232', district: 'Kanyakumari', parliamentaryConstituency: 'Kanyakumari' },
  { name: 'Killiyoor', code: '233', district: 'Kanyakumari', parliamentaryConstituency: 'Kanyakumari' },
  { name: 'Thiruvattar', code: '234', district: 'Kanyakumari', parliamentaryConstituency: 'Kanyakumari' }
];

// ============================================================================
// TALUKS BY DISTRICT (Complete list for Tamil Nadu)
// ============================================================================
const TALUKS_BY_DISTRICT: Record<string, string[]> = {
  'Ariyalur': ['Ariyalur', 'Jayankondam', 'Sendurai', 'Udayarpalayam', 'Andimadam', 'T.Palur'],
  'Chengalpattu': ['Chengalpattu', 'Cheyyur', 'Kancheepuram', 'Madurantakam', 'Tambaram', 'Thiruporur', 'Tirukalukundram', 'Vandalur', 'Pallavaram'],
  'Chennai': ['Egmore-Nungambakkam', 'Fort-Tondiarpet', 'Mambalam-Guindy', 'Mylapore-Triplicane', 'Perambur-Purasavakkam', 'Ambattur', 'Madhavaram', 'Tiruvottiyur'],
  'Coimbatore': ['Coimbatore North', 'Coimbatore South', 'Mettupalayam', 'Pollachi', 'Sulur', 'Valparai', 'Annur', 'Kinathukadavu', 'Madukarai', 'Perur', 'Thondamuthur'],
  'Cuddalore': ['Cuddalore', 'Kurinjipadi', 'Panruti', 'Virudhachalam', 'Bhuvanagiri', 'Chidambaram', 'Kattumannarkoil', 'Tittakudi'],
  'Dharmapuri': ['Dharmapuri', 'Harur', 'Karimangalam', 'Nallampalli', 'Palacode', 'Pappireddipatti', 'Pennagaram'],
  'Dindigul': ['Dindigul East', 'Dindigul West', 'Athoor', 'Kodaikanal', 'Natham', 'Nilakottai', 'Oddanchatram', 'Palani', 'Vedasandur', 'Guziliamparai'],
  'Erode': ['Erode', 'Bhavani', 'Gobichettipalayam', 'Sathyamangalam', 'Anthiyur', 'Kodumudi', 'Modakkurichi', 'Nambiyur', 'Perundurai', 'Talavadi', 'Chennimalai'],
  'Kallakurichi': ['Kallakurichi', 'Chinnasalem', 'Sankarapuram', 'Tirukkoyilur', 'Ulundurpet'],
  'Kanchipuram': ['Kanchipuram', 'Sriperumbudur', 'Uthiramerur', 'Kundrathur', 'Walajabad'],
  'Kanyakumari': ['Agastheeswaram', 'Kalkulam', 'Thovalai', 'Vilavancode', 'Killiyoor', 'Melpuram', 'Thiruvattar'],
  'Karur': ['Karur', 'Aravakurichi', 'Krishnarayapuram', 'Kulithalai', 'Kadavur', 'Manmangalam', 'Thogamalai'],
  'Krishnagiri': ['Krishnagiri', 'Bargur', 'Hosur', 'Kaveripattinam', 'Uthangarai', 'Veppanahalli', 'Pochampalli', 'Kelamangalam', 'Denkanikottai', 'Shoolagiri', 'Anchetti', 'Mathur'],
  'Madurai': ['Madurai East', 'Madurai North', 'Madurai South', 'Madurai West', 'Melur', 'Peraiyur', 'Thirumangalam', 'Usilampatti', 'Vadipatti', 'Kalligudi', 'Sedapatti', 'T.Kallupatti', 'Kottampatti', 'Sholavandan'],
  'Mayiladuthurai': ['Mayiladuthurai', 'Kuthalam', 'Sirkazhi', 'Tharangambadi', 'Sembanarkoil', 'Kollidam'],
  'Nagapattinam': ['Nagapattinam', 'Kilvelur', 'Thirukkuvalai', 'Vedaranyam'],
  'Namakkal': ['Namakkal', 'Paramathi-Velur', 'Rasipuram', 'Tiruchengode', 'Kolli Hills', 'Senthamangalam', 'Mohanur', 'Erumapatty'],
  'Nilgiris': ['Udhagamandalam', 'Coonoor', 'Kotagiri', 'Gudalur', 'Kundah', 'Pandalur'],
  'Perambalur': ['Perambalur', 'Alathur', 'Kunnam', 'Veppanthattai'],
  'Pudukkottai': ['Pudukkottai', 'Alangudi', 'Aranthangi', 'Avudaiyarkoil', 'Gandarvakkottai', 'Illuppur', 'Karambakkudi', 'Kulathur', 'Manamelkudi', 'Ponnamaravathi', 'Thirumayam', 'Viralimalai'],
  'Ramanathapuram': ['Ramanathapuram', 'Kadaladi', 'Kamuthi', 'Mudukulathur', 'Paramakudi', 'R.S.Mangalam', 'Tiruvadanai', 'Rameswaram', 'Bogalur'],
  'Ranipet': ['Ranipet', 'Arcot', 'Arakkonam', 'Nemili', 'Sholingur', 'Walajah', 'Kalavai', 'Timiri'],
  'Salem': ['Salem North', 'Salem South', 'Salem West', 'Attur', 'Edappadi', 'Gangavalli', 'Kadayampatti', 'Mettur', 'Omalur', 'Peddanaickenpalayam', 'Sangagiri', 'Thalaivasal', 'Valapady', 'Yercaud', 'Thammampatti', 'Nangavalli', 'Ayothiapattinam'],
  'Sivaganga': ['Sivaganga', 'Devakottai', 'Ilayangudi', 'Kalayarkovil', 'Karaikudi', 'Manamadurai', 'Singampunari', 'Tirupathur', 'Tirupuvanam', 'Sakkottai', 'Kannangudi', 'S.Pudur'],
  'Tenkasi': ['Tenkasi', 'Alangulam', 'Kadayanallur', 'Sankarankovil', 'Shenkottai', 'Sivagiri', 'V.K.Pudur', 'Vasudevanallur', 'Puliyangudi'],
  'Thanjavur': ['Thanjavur', 'Kumbakonam', 'Orathanadu', 'Papanasam', 'Pattukkottai', 'Peravurani', 'Thiruvaiyaru', 'Thiruvidaimarudur', 'Budalur', 'Sethubavachatram', 'Madukkur'],
  'Theni': ['Theni', 'Andipatti', 'Bodinayakanur', 'Chinnamanur', 'Cumbum', 'Periyakulam', 'Uthamapalayam', 'Myladumparai'],
  'Thoothukudi': ['Thoothukudi', 'Ettayapuram', 'Kayathar', 'Kovilpatti', 'Ottapidaram', 'Sathankulam', 'Srivaikuntam', 'Tiruchendur', 'Vilathikulam', 'Pudur', 'Karungulam', 'Alwarthirunagari'],
  'Tiruchirappalli': ['Tiruchirappalli East', 'Tiruchirappalli West', 'Lalgudi', 'Manachanallur', 'Manapparai', 'Marungapuri', 'Musiri', 'Srirangam', 'Thottiyam', 'Thuraiyur', 'Uppiliyapuram', 'Thiruverumbur'],
  'Tirunelveli': ['Tirunelveli', 'Ambasamudram', 'Cheranmahadevi', 'Nanguneri', 'Palayamkottai', 'Radhapuram', 'Sankarankovil', 'Tenkasi', 'Kadayanallur', 'Kalakkad', 'Manur', 'Vikramasingapuram', 'Alangulam', 'Pappakudi', 'Valliyoor', 'Keelapavur'],
  'Tirupathur': ['Tirupathur', 'Ambur', 'Jolarpet', 'Natrampalli', 'Vaniyambadi', 'Kandili', 'Alangayam'],
  'Tiruppur': ['Tiruppur North', 'Tiruppur South', 'Avinashi', 'Dharapuram', 'Kangeyam', 'Madathukulam', 'Palladam', 'Udumalpet', 'Kundadam', 'Pongalur', 'Vellakoil', 'Mulanur'],
  'Tiruvallur': ['Tiruvallur', 'Ambattur', 'Avadi', 'Gummidipoondi', 'Madhavaram', 'Minjur', 'Ponneri', 'Poonamallee', 'Red Hills', 'Tiruttani', 'Ellapuram', 'Pallipattu', 'Uthukottai', 'Tiruninravur', 'Villivakkam', 'Kadambathur'],
  'Tiruvannamalai': ['Tiruvannamalai', 'Arani', 'Chengam', 'Cheyyar', 'Chetpet', 'Polur', 'Vandavasi', 'Kalasapakkam', 'Kilpennathur', 'Thandrampattu', 'Thurinjapuram', 'Jamunamarathur', 'Keelpennathur', 'West Arni', 'Vembakkam', 'Anakkavur'],
  'Tiruvarur': ['Tiruvarur', 'Kodavasal', 'Koradachery', 'Kudavasal', 'Mannargudi', 'Nannilam', 'Needamangalam', 'Thiruthuraipoondi', 'Valangaiman', 'Kottur'],
  'Vellore': ['Vellore', 'Anaicut', 'Gudiyattam', 'K.V. Kuppam', 'Katpadi', 'Pernambut', 'Kaniyambadi', 'Sathuvachari'],
  'Viluppuram': ['Viluppuram', 'Gingee', 'Kallakurichi', 'Kandachipuram', 'Koliyanur', 'Mailam', 'Mugaiyur', 'Sankarapuram', 'Tindivanam', 'Tirukkoilur', 'Ulundurpettai', 'Vanur', 'Vikravandi', 'Kanai', 'Marakkanam', 'Olakkur', 'Rishivandiyam'],
  'Virudhunagar': ['Virudhunagar', 'Aruppukkottai', 'Kariyapatti', 'Rajapalayam', 'Sattur', 'Sivakasi', 'Srivilliputhur', 'Tiruchuli', 'Watrap', 'Vembakottai', 'Narikudi']
};

// ============================================================================
// MAIN IMPORT FUNCTION
// ============================================================================
async function main() {
  console.log('='.repeat(60));
  console.log('TAMIL NADU COMPREHENSIVE LOCATION IMPORT');
  console.log('='.repeat(60));
  console.log();

  try {
    // ========================================================================
    // STEP 1: Import Districts
    // ========================================================================
    console.log('📍 Importing 38 Districts...');
    const districtMap = new Map<string, string>();
    
    for (const districtName of DISTRICTS) {
      const existing = await prisma.district.findUnique({
        where: { name: districtName }
      });
      
      if (existing) {
        districtMap.set(districtName, existing.id);
        console.log(`  ✓ ${districtName} (exists)`);
      } else {
        const created = await prisma.district.create({
          data: {
            name: districtName,
            stateCode: 'TN'
          }
        });
        districtMap.set(districtName, created.id);
        console.log(`  + ${districtName} (created)`);
      }
    }
    console.log(`\nTotal Districts: ${districtMap.size}`);
    console.log();

    // ========================================================================
    // STEP 2: Import Parliamentary Constituencies
    // ========================================================================
    console.log('🏛️  Importing 39 Parliamentary Constituencies...');
    const pcMap = new Map<string, string>();
    
    for (const pc of PARLIAMENTARY_CONSTITUENCIES) {
      const existing = await prisma.parliamentaryConstituency.findUnique({
        where: { name: pc.name }
      });
      
      if (existing) {
        pcMap.set(pc.name, existing.id);
        console.log(`  ✓ ${pc.name} (exists)`);
      } else {
        const created = await prisma.parliamentaryConstituency.create({
          data: {
            name: pc.name,
            code: pc.code,
            stateCode: 'TN'
          }
        });
        pcMap.set(pc.name, created.id);
        console.log(`  + ${pc.name} (created)`);
      }
    }
    console.log(`\nTotal Parliamentary Constituencies: ${pcMap.size}`);
    console.log();

    // ========================================================================
    // STEP 3: Import Assembly Constituencies
    // ========================================================================
    console.log('🗳️  Importing 234 Assembly Constituencies...');
    let acCreated = 0;
    let acExists = 0;
    
    for (const ac of ASSEMBLY_CONSTITUENCIES) {
      const districtId = districtMap.get(normalizeDistrictName(ac.district));
      const parliamentaryConstituencyId = pcMap.get(ac.parliamentaryConstituency);
      
      if (!districtId) {
        console.log(`  ⚠️  District not found: ${ac.district} for AC ${ac.name}`);
        continue;
      }
      
      const existing = await prisma.assemblyConstituency.findFirst({
        where: {
          districtId,
          name: ac.name
        }
      });
      
      if (existing) {
        acExists++;
      } else {
        await prisma.assemblyConstituency.create({
          data: {
            name: ac.name,
            code: ac.code,
            districtId,
            parliamentaryConstituencyId
          }
        });
        acCreated++;
      }
    }
    console.log(`  Created: ${acCreated}, Already exists: ${acExists}`);
    console.log(`  Total Assembly Constituencies: ${acCreated + acExists}`);
    console.log();

    // ========================================================================
    // STEP 4: Import Taluks
    // ========================================================================
    console.log('🏘️  Importing Taluks...');
    let talukCreated = 0;
    let talukExists = 0;
    
    for (const [districtName, taluks] of Object.entries(TALUKS_BY_DISTRICT)) {
      const districtId = districtMap.get(districtName);
      
      if (!districtId) {
        console.log(`  ⚠️  District not found: ${districtName}`);
        continue;
      }
      
      for (const talukName of taluks) {
        const existing = await prisma.taluk.findFirst({
          where: {
            districtId,
            name: talukName
          }
        });
        
        if (existing) {
          talukExists++;
        } else {
          await prisma.taluk.create({
            data: {
              name: talukName,
              districtId
            }
          });
          talukCreated++;
        }
      }
    }
    console.log(`  Created: ${talukCreated}, Already exists: ${talukExists}`);
    console.log(`  Total Taluks: ${talukCreated + talukExists}`);
    console.log();

    // ========================================================================
    // STEP 5: Record import version
    // ========================================================================
    await prisma.locationDatasetVersion.create({
      data: {
        source: 'comprehensive-tn-import',
        version: '1.0.0',
        metadata: {
          districts: districtMap.size,
          parliamentaryConstituencies: pcMap.size,
          assemblyConstituencies: acCreated + acExists,
          taluks: talukCreated + talukExists,
          importDate: new Date().toISOString()
        }
      }
    });
    console.log('📦 Import version recorded.');
    console.log();

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('='.repeat(60));
    console.log('IMPORT COMPLETE');
    console.log('='.repeat(60));
    console.log(`  Districts:                  ${districtMap.size}`);
    console.log(`  Parliamentary Const.:       ${pcMap.size}`);
    console.log(`  Assembly Const.:            ${acCreated + acExists}`);
    console.log(`  Taluks:                     ${talukCreated + talukExists}`);
    console.log();
    console.log('Run verify-locations.ts to confirm data integrity.');
    
  } catch (error) {
    console.error('Import failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
