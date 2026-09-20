/* ─── helpers ─── */

function genId() {
  return 'P-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

/* ─── global time tick (shared across TimeAgo instances) ─── */

const timeListeners = new Set();
let timeTick = 0;

if (typeof window !== 'undefined') {
  setInterval(() => {
    timeTick++;
    timeListeners.forEach((listener) => listener());
  }, 30000);
}

export function subscribeToTimeTick(listener) {
  timeListeners.add(listener);
  return () => timeListeners.delete(listener);
}

export function getTimeTick() {
  return timeTick;
}

/* ─── format ─── */

function formatCount(value) {
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : value;
}

function formatEventTime(datetimeLocal) {
  if (!datetimeLocal) return '';
  const date = new Date(datetimeLocal);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const weekday = date.toLocaleDateString('zh-CN', { weekday: 'short' });

  return `${month}.${day} ${weekday} ${hours}:${minutes}`;
}

// 格式化相对时间 + 具体时间 (e.g. "2小时前 · 2024/05/12 14:30")
function formatTimeAgo(timeString) {
  if (!timeString) return '';

  const date = new Date(timeString);
  if (isNaN(date.getTime())) return timeString;

  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  let ago;
  if (diffYear > 0) {
    ago = `${diffYear}年前`;
  } else if (diffMonth > 0) {
    ago = `${diffMonth}月前`;
  } else if (diffDay > 0) {
    ago = `${diffDay}天前`;
  } else if (diffHour > 0) {
    ago = `${diffHour}小时前`;
  } else if (diffMin > 0) {
    ago = `${diffMin}分钟前`;
  } else {
    ago = '刚刚';
  }

  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const fullTime = `${year}/${month}/${day} ${hours}:${minutes}`;

  return `${ago} · ${fullTime}`;
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

/* ─── anonymity system ─── */

function getUserId() {
  let uid = localStorage.getItem('nju_user_id');
  if (!uid) {
    uid = 'U-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    localStorage.setItem('nju_user_id', uid);
  }
  return uid;
}

const CURRENT_USER_ID = getUserId();

// 英文名字池 (1000+个)
const NAMES = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Edward', 'Fiona', 'George', 'Hannah',
  'Ivan', 'Julia', 'Kevin', 'Linda', 'Michael', 'Nancy', 'Oscar', 'Penny',
  'Quinn', 'Rachel', 'Sam', 'Tina', 'Ulysses', 'Vera', 'Walter', 'Xena',
  'Yuri', 'Zoe', 'Aaron', 'Beth', 'Clark', 'Doris', 'Evan', 'Faith',
  'Gary', 'Helen', 'Isaac', 'Jade', 'Kyle', 'Luna', 'Mark', 'Nora',
  'Oliver', 'Pam', 'Quincy', 'Rosa', 'Steve', 'Tara', 'Uma', 'Victor',
  'Wendy', 'Xander', 'Yuki', 'Zara', 'Adam', 'Bella', 'Chris', 'Dora',
  'Eric', 'Faye', 'Greg', 'Hope', 'Ian', 'Jane', 'Ken', 'Lisa',
  'Mason', 'Nina', 'Owen', 'Paige', 'Reid', 'Sara', 'Tom', 'Vera',
  'Will', 'Amy', 'Ben', 'Cora', 'Dan', 'Emma', 'Finn', 'Grace',
  'Hank', 'Iris', 'Jack', 'Kara', 'Leo', 'Mia', 'Nick', 'Olivia',
  'Paul', 'Quill', 'Ruby', 'Seth', 'Troy', 'Unity', 'Vince', 'Willow',
  'Alex', 'Bri', 'Cameron', 'Drew', 'Elliot', 'Frankie', 'Gray', 'Harper',
  'Indigo', 'Jordan', 'Kai', 'Logan', 'Morgan', 'Noel', 'Oakley', 'Parker',
  'River', 'Sage', 'Taylor', 'Blake', 'Adrian', 'Bailey', 'Casey', 'Devin',
  'Eden', 'Flynn', 'Gale', 'Haven', 'Ingrid', 'James', 'Kira', 'Lane',
  'Nico', 'Odin', 'Phoenix', 'Remy', 'Shane', 'Teagan', 'Winter', 'Alexis',
  'Emery', 'Hayden', 'Jaden', 'Mackenzie', 'Reese', 'Skyler', 'Ainsley',
  'Arden', 'Aubrey', 'Berkeley', 'Billie', 'Blair', 'Brett', 'Brooke', 'Brook',
  'Cael', 'Campbell', 'Cannon', 'Cardiff', 'Carey', 'Cassidy', 'Chandler',
  'Charleston', 'Chase', 'Cian', 'Clarke', 'Claudio', 'Cody', 'Cole', 'Corey',
  'Courtney', 'Craig', 'Crew', 'Dallas', 'Dana', 'Dani', 'Daniel', 'Darcy',
  'Daryl', 'Dee', 'Delsey', 'Demi', 'Dennis', 'Derek', 'Desmond', 'Devin',
  'Dexter', 'Dillon', 'Dorian', 'Douglas', 'Drake', 'Dylan', 'Eason', 'Eddie',
  'Eden', 'Elliott', 'Ellis', 'Elora', 'Emerson', 'Emlyn', 'Ephraim', 'Erin',
  'Esme', 'Ethan', 'Felix', 'Finley', 'Finn', 'Floyd', 'Flynn', 'Ford',
  'Francis', 'Frank', 'Gabriel', 'Gareth', 'Gavin', 'Gene', 'Graham', 'Grant',
  'Green', 'Griffin', 'Hadley', 'Hailey', 'Hampton', 'Harley', 'Harriet',
  'Harrison', 'Harvey', 'Heath', 'Hedy', 'Helena', 'Holly', 'Howard', 'Hugh',
  'Hugo', 'Isla', 'Ivy', 'Jackson', 'Jacob', 'Jasper', 'Jayden', 'Jean',
  'Jem', 'Jensen', 'Jeremy', 'Jesse', 'Jett', 'Joan', 'Jody', 'Joe', 'John',
  'Jonathan', 'Jory', 'Jose', 'Josh', 'Joshua', 'Jude', 'Julian', 'Julius',
  'Justin', 'Kailey', 'Kaleb', 'Kane', 'Kara', 'Karen', 'Katelyn', 'Keith',
  'Kelly', 'Kelsey', 'Kennedy', 'Kenneth', 'Kerry', 'Kieran', 'Kim', 'Kinley',
  'Kirby', 'Kit', 'Kristen', 'Kristin', 'Kylie', 'Laken', 'Lana', 'Larry',
  'Laura', 'Lauren', 'Lee', 'Leon', 'Levi', 'Lewis', 'Liam', 'Lillian',
  'Lincoln', 'Lindsay', 'Lloyd', 'London', 'Louis', 'Lucas', 'Lucy', 'Luke',
  'Lyric', 'Mabel', 'Mac', 'Macy', 'Madeline', 'Malcolm', 'Malia', 'Marcus',
  'Margaret', 'Maria', 'Marilyn', 'Marley', 'Mars', 'Marty', 'Matilda', 'Maya',
  'Mckenna', 'Megan', 'Mekhi', 'Melanie', 'Melissa', 'Michele', 'Mickey',
  'Miley', 'Miller', 'Milo', 'Molly', 'Monica', 'Moses', 'Murray', 'Myles',
  'Nadia', 'Naomi', 'Nash', 'Natalia', 'Natasha', 'Nathan', 'Neil', 'Nelson',
  'Nevaeh', 'Nicolas', 'Noah', 'Nora', 'Norah', 'Nova', 'Nyle', 'Oakes',
  'Oasis', 'Ocean', 'Olive', 'Ollie', 'Onyx', 'Opal', 'Orion', 'Otto',
  'Pablo', 'Pace', 'Parsons', 'Patience', 'Patton', 'Paxton', 'Payton', 'Pearl',
  'Pebble', 'Perry', 'Peter', 'Petra', 'Peyton', 'Philip', 'Phoebe', 'Pierce',
  'Piper', 'Poe', 'Polly', 'Porter', 'Powell', 'Preston', 'Prim', 'Priscilla',
  'Quentin', 'Rae', 'Rain', 'Raphael', 'Ray', 'Raymond', 'Reagan', 'Remi',
  'Rene', 'Rex', 'Rhett', 'Rhys', 'Robin', 'Rocky', 'Rodney', 'Roman', 'Romeo',
  'Ronan', 'Roscoe', 'Ross', 'Rowan', 'Royal', 'Ruth', 'Ryder', 'Rylan',
  'Salem', 'Samantha', 'Samuel', 'Sawyer', 'Scarlett', 'Scott', 'Sean',
  'Sebastian', 'Selene', 'Serena', 'Shannon', 'Shawn', 'Shelby', 'Sheldon',
  'Sherlock', 'Shirley', 'Silas', 'Simon', 'Slate', 'Sloane', 'Spencer',
  'Stanley', 'Stella', 'Stephanie', 'Steve', 'Steven', 'Storm', 'Summer',
  'Sven', 'Sybil', 'Sydney', 'Sylvester', 'Sykes', 'Talia', 'Tanner', 'Tate',
  'Teddy', 'Terry', 'Texas', 'Thalia', 'Thea', 'Theo', 'Thomas', 'Tiger',
  'Timothy', 'Tobias', 'Toby', 'Todd', 'Toni', 'Tony', 'Tory', 'Trace',
  'Travis', 'Trent', 'Trevor', 'Trey', 'Tristan', 'Troy', 'Truman', 'Tucker',
  'Tudy', 'Tyler', 'Upton', 'Ursula', 'Val', 'Valentina', 'Valerie', 'Van',
  'Vance', 'Vernon', 'Victoria', 'Violet', 'Virginia', 'Wade', 'Wagner',
  'Walker', 'Wallace', 'Walt', 'Wanda', 'Warren', 'Wayne', 'Wesley', 'Weston',
  'Willa', 'William', 'Willow', 'Wilson', 'Winnie', 'Winston', 'Wyatt', 'Wylie',
  'Xavier', 'Xerxes', 'Yael', 'Yale', 'Yankee', 'Yara', 'Yardley', 'Yasmin',
  'Yates', 'Yves', 'Zach', 'Zachary', 'Zaden', 'Zahara', 'Zahir', 'Zayden',
  'Zelda', 'Zion', 'Zola', 'Zyler', 'Abel', 'Albie', 'Alden', 'Alton',
  'Ambrose', 'Anson', 'Archer', 'Ari', 'Ariel', 'Arlo', 'Arsen', 'Artemis',
  'Asa', 'Ash', 'Atticus', 'Aurelia', 'Aurora', 'Azariah', 'Basil', 'Bear',
  'Bea', 'Beau', 'Bennett', 'Benson', 'Bexley', 'Bidwell', 'Bishop', 'Blaze',
  'Boden', 'Boone', 'Bowie', 'Brady', 'Braxton', 'Brent', 'Briar', 'Briggs',
  'Bristol', 'Britt', 'Britta', 'Bronte', 'Bryce', 'Buck', 'Buddy', 'Calder',
  'Calvin', 'Cam', 'Camila', 'Camilla', 'Capri', 'Carl', 'Carlisle', 'Carlos',
  'Carolina', 'Carrie', 'Cary', 'Caspian', 'Cassandra', 'Cassian', 'Celeste',
  'Chelsea', 'Cherry', 'Chester', 'Cheyenne', 'Chloe', 'Christina', 'Claire',
  'Clara', 'Clarissa', 'Claudia', 'Clementine', 'Cleopatra', 'Clive', 'Coco',
  'Colby', 'Colin', 'Colt', 'Colton', 'Conrad', 'Constance', 'Cooper', 'Corbyn',
  'Cordelia', 'Cornelius', 'Corinne', 'Crispin', 'Crystal', 'Cullen', 'Cybil',
  'Cyrus', 'Dahlia', 'Dalton', 'Damian', 'Damon', 'Daniela', 'Daphne', 'Darius',
  'Davina', 'Declan', 'Delta', 'Demetrius', 'Denise', 'Desiree', 'Destiny',
  'Dominic', 'Dominique', 'Don', 'Donovan', 'Dorothy', 'Earl', 'Echo', 'Edgar',
  'Edith', 'Edmund', 'Edna', 'Eleanor', 'Elena', 'Elijah', 'Elise', 'Eliza',
  'Elizabeth', 'Ella', 'Ellen', 'Elmer', 'Elsa', 'Elsie', 'Emilia', 'Emily',
  'Enid', 'Enoch', 'Errol', 'Estella', 'Esther', 'Eugene', 'Eunice', 'Evangeline',
  'Eve', 'Evelyn', 'Ezra', 'Fable', 'Fabian', 'Flora', 'Florence', 'Flossie',
  'Forrest', 'Frances', 'Frederick', 'Freya', 'Frida', 'Fritz', 'Gabe',
  'Galen', 'Gemma', 'Georgie', 'Georgina', 'Gertrude', 'Gideon', 'Gigi',
  'Giles', 'Gina', 'Ginger', 'Giselle', 'Gloria', 'Godfrey', 'Goldie', 'Gordon',
  'Gracie', 'Grady', 'Grayson', 'Greta', 'Gus', 'Gustav', 'Hana', 'Hattie',
  'Hazel', 'Heidi', 'Hendrik', 'Hester', 'Hollis', 'Honor', 'Horace', 'Hortense',
  'Hubert', 'Ida', 'Idris', 'Ike', 'Iona', 'Irene', 'Isabel', 'Isadora',
  'Jabez', 'Jacqueline', 'Javi', 'Jenna', 'Jerald', 'Jerome', 'Jessie', 'Joanna',
  'Joanne', 'Jocelyn', 'Joelle', 'Jonah', 'Joseph', 'Josephine', 'Josie',
  'Joyce', 'Judith', 'Judy', 'Juliet', 'Juliette', 'Kaitlyn', 'Karla', 'Karina',
  'Karlene', 'Keanu', 'Keegan', 'Keenan', 'Keily', 'Kelsea', 'Kenny', 'Kesley',
  'Kezia', 'Kia', 'Kian', 'Kiana', 'Kiera', 'Kiki', 'Kitty', 'Kyla', 'Lachie',
  'Lacy', 'Landon', 'Lara', 'Laredo', 'Larissa', 'Lars', 'Laurence', 'Laurie',
  'Layla', 'Lea', 'Leah', 'Leif', 'Leila', 'Lennox', 'Leonard', 'Leonardo',
  'Leona', 'Leonie', 'Leonora', 'Leslie', 'Lester', 'Libby', 'Lila', 'Lilac',
  'Lily', 'Livia', 'Lockie', 'Lois', 'Lola', 'Loma', 'Lonnie', 'Lorenzo',
  'Lorraine', 'Lou', 'Louise', 'Lowell', 'Lucia', 'Lucian', 'Lucille', 'Luigi',
  'Luis', 'Luka', 'Luther', 'Lyra', 'Maci', 'Macon', 'Maddie', 'Maia',
  'Maiden', 'Malkovich', 'Mallory', 'Mandel', 'Mara', 'Marcel', 'Marcella',
  'Marco', 'Mariam', 'Marie', 'Marina', 'Marion', 'Marisa', 'Marisol', 'Marissa',
  'Marlon', 'Marlow', 'Marsh', 'Marvel', 'Marvin', 'Mathilda', 'Matthias',
  'Maude', 'Maura', 'Maverick', 'Maximilian', 'Maxine', 'Meghan', 'Melody',
  'Meredith', 'Merle', 'Merlin', 'Midas', 'Mika', 'Mike', 'Miriam', 'Mona',
  'Monique', 'Monte', 'Montgomery', 'Moxie', 'Myra', 'Myrtle', 'Nadine',
  'Nagisa', 'Nathanael', 'Neal', 'Ned', 'Nemo', 'Neo', 'Nessie', 'Nicholas',
  'Nickolas', 'Nikita', 'Nikki', 'Nile', 'Nish', 'Nola', 'Norma', 'Norman',
  'Normandy', 'Norris', 'Odelia', 'Odysseus', 'Ola', 'Olaf', 'Olga', 'Ondine',
  'Orla', 'Orlando', 'Orson', 'Osiris', 'Pacey', 'Paddy', 'Padraig', 'Paloma',
  'Panda', 'Pansy', 'Paradise', 'Paris', 'Pascal', 'Patriot', 'Patsy', 'Paula',
  'Paulina', 'Paulo', 'Peace', 'Pearlie', 'Pedro', 'Pepper', 'Persephone',
  'Petunia', 'Phyllis', 'Pip', 'Plato', 'Poppy', 'Poseidon', 'Pounce', 'Prairie',
  'Prima', 'Prudence', 'Quest', 'Quintessa', 'Quintrell', 'Raegan', 'Rafael',
  'Raine', 'Raisin', 'Raquel', 'Raysa', 'Reanne', 'Rebecca', 'Rebekah', 'Ren',
  'Renata', 'Renée', 'Reyna', 'Rhiannon', 'Rhoda', 'Rhona', 'Rhythm', 'Rian',
  'Rio', 'Rip', 'Roan', 'Roark', 'Roberto', 'Rocco', 'Roddy', 'Roger', 'Rohan',
  'Rosalie', 'Rosalind', 'Rosella', 'Roselyn', 'Rosie', 'Rowdy', 'Ruthie',
  'Rylee', 'Sabrina', 'Sally', 'Salty', 'Sandy', 'Santa', 'Sasha', 'Saul',
  'Seamus', 'Selina', 'Shania', 'Sharon', 'Shayla', 'Sherman', 'Shyla', 'Simone',
  'Skylar', 'Snow', 'Solomon', 'Sonia', 'Sonya', 'Sophia', 'Sophie', 'Soraya',
  'Squiggy', 'Sunny', 'Sylvia', 'Tabitha', 'Tallulah', 'Tammy', 'Tanya', 'Taryn',
  'Teresa', 'Terra', 'Tessa', 'Theodore', 'Thunder', 'Trixie', 'Trudy', 'Tudor',
  'Tula', 'Tully', 'Tuxedo', 'Ulric', 'Vada', 'Veronica', 'Vesper', 'Vienna',
  'Waldo', 'Wasco', 'Wellesley', 'Windsor', 'Wolfgang', 'Woodrow', 'Yarden',
  'Yvonne', 'Abigail', 'Ada', 'Adelaide', 'Adrian', 'Alana', 'Albert', 'Alfred',
  'Alison', 'Amanda', 'Amber', 'Amelia', 'Andre', 'Andrea', 'Angela', 'Anna',
  'Anne', 'Anthony', 'Ashley', 'August', 'Barbara', 'Bernard', 'Bernice',
  'Beryl', 'Beverly', 'Bill', 'Blanche', 'Brenda', 'Brian', 'Bridget', 'Bruno',
  'Callum', 'Caleb', 'Carla', 'Carly', 'Caroline', 'Catherine', 'Cecilia',
  'Chad', 'Chantal', 'Charley', 'Charlotte', 'Chloe', 'Clara', 'Clifford',
  'Conor', 'Constance', 'Cora', 'Curtis', 'Daisy', 'Dallas', 'Dana', 'David',
  'Dawn', 'Dean', 'Deborah', 'Denise', 'Dennis', 'Derek', 'Desmond', 'Diana',
  'Dominic', 'Donnie', 'Dora', 'Dorothy', 'Earl', 'Edward', 'Elaine', 'Eleanor',
  'Elena', 'Elias', 'Elijah', 'Elizabeth', 'Ella', 'Emily', 'Emma', 'Eric',
  'Erica', 'Erik', 'Ernest', 'Esme', 'Esther', 'Eugene', 'Eva', 'Evelyn',
  'Faye', 'Felix', 'Flora', 'Florence', 'Frances', 'Francis', 'Frederick',
  'Gabriel', 'Genevieve', 'George', 'Gerald', 'Gloria', 'Grace', 'Gregory',
  'Hannah', 'Harold', 'Harriet', 'Harry', 'Harvey', 'Heather', 'Helen', 'Henry',
  'Howard', 'Hugh', 'Ian', 'Iris', 'Isabel', 'Jacob', 'James', 'Jane', 'Janet',
  'Jasmine', 'Jean', 'Jeffrey', 'Jennifer', 'Jeremy', 'Jesse', 'Joan', 'Joanna',
  'Joanne', 'Joe', 'John', 'Jonathan', 'Jordan', 'Joseph', 'Judith', 'Julie',
  'Katherine', 'Kathleen', 'Kayla', 'Keith', 'Kelly', 'Kevin', 'Kiera',
  'Kristen', 'Lance', 'Larry', 'Laura', 'Lauren', 'Lawrence', 'Leon', 'Lillian',
  'Lily', 'Linda', 'Lisa', 'Logan', 'Louis', 'Lucy', 'Luke', 'Madeline', 'Madison',
  'Margaret', 'Maria', 'Marie', 'Marilyn', 'Mark', 'Marlon', 'Martin', 'Mary',
  'Mason', 'Matthew', 'Megan', 'Melissa', 'Michele', 'Michelle', 'Mila', 'Miley',
  'Molly', 'Monica', 'Morgan', 'Nancy', 'Natalia', 'Nathan', 'Nicholas', 'Nicole',
  'Noah', 'Nora', 'Olivia', 'Pamela', 'Patricia', 'Patrick', 'Paul', 'Paula',
  'Peter', 'Philip', 'Rachel', 'Rebecca', 'Renee', 'Richard', 'Robert', 'Robin',
  'Rose', 'Ruth', 'Ryan', 'Sabrina', 'Samantha', 'Samuel', 'Sandra', 'Sara',
  'Sarah', 'Scott', 'Sean', 'Sharon', 'Sheila', 'Shirley', 'Simon', 'Sonia',
  'Sophia', 'Stephanie', 'Steven', 'Susan', 'Taylor', 'Thomas', 'Timothy',
  'Tina', 'Todd', 'Tracy', 'Trinity', 'Troy', 'Tyler', 'Valerie', 'Victor',
  'Victoria', 'Vincent', 'Virginia', 'Walter', 'Wendy', 'William', 'Willow',
  'Zoe', 'Amelia', 'Arlo', 'Aston', 'Athena', 'Aubrey', 'Beau', 'Briar', 'Brooks',
  'Cedar', 'Chase', 'Claire', 'Clara', 'Clive', 'Cody', 'Cole', 'Cooper', 'Crystal',
  'Daisy', 'Dallas', 'Damon', 'Daniel', 'Daphne', 'Dawn', 'Declan', 'Derek',
  'Desiree', 'Dexter', 'Dolly', 'Dylan', 'Edith', 'Elsa', 'Ethan', 'Evelyn',
  'Finley', 'Flora', 'Flynn', 'Francis', 'Frank', 'Freya', 'Georgia', 'Grace',
  'Grant', 'Grayson', 'Harley', 'Harper', 'Harriet', 'Harrison', 'Hayden', 'Holly',
  'Hugo', 'Ivy', 'Jack', 'Jacob', 'James', 'Jasper', 'Jenna', 'Jessica', 'Jonah',
  'Jonathan', 'Jude', 'Julia', 'Julius', 'Kai', 'Katherine', 'Kennedy', 'Kevin',
  'Kyle', 'Landon', 'Lane', 'Larry', 'Laura', 'Lena', 'Leonard', 'Levi', 'Liam',
  'Lillian', 'Lincoln', 'Logan', 'Louis', 'Lucy', 'Luke', 'Luna', 'Mabel',
  'Mae', 'Magnus', 'Makenzie', 'Malia', 'Marcus', 'Margaret', 'Marilyn', 'Mason',
  'Matilda', 'Matthew', 'Max', 'Maxwell', 'Maya', 'Megan', 'Melanie', 'Melody',
  'Mia', 'Michael', 'Michele', 'Mira', 'Mona', 'Morgan', 'Nancy', 'Natalie',
  'Nathan', 'Nina', 'Noah', 'Nora', 'Oakley', 'Oliver', 'Olivia', 'Owen', 'Paige',
  'Pamela', 'Parker', 'Patrick', 'Paul', 'Paula', 'Pearl', 'Peter', 'Phoenix',
  'Piper', 'Priscilla', 'Quinn', 'Rachel', 'Rafael', 'Reagan', 'Rebecca', 'Reese',
  'Regina', 'Richard', 'Riley', 'River', 'Robert', 'Robin', 'Rose', 'Rosie',
  'Ruby', 'Ruth', 'Ryan', 'Sage', 'Sam', 'Samantha', 'Samuel', 'Sandra', 'Sara',
  'Sarah', 'Sawyer', 'Scarlett', 'Scott', 'Sean', 'Sebastian', 'Selena',
  'Shane', 'Shannon', 'Sharon', 'Shawn', 'Sierra', 'Simon', 'Skyler', 'Sofia',
  'Solomon', 'Sophia', 'Sophie', 'Spencer', 'Stella', 'Stephanie', 'Steven',
  'Summer', 'Susan', 'Taylor', 'Teresa', 'Thomas', 'Tim', 'Tina', 'Trinity',
  'Troy', 'Tyler', 'Valentina', 'Valerie', 'Victor', 'Victoria', 'Vienna', 'Violet',
  'Virginia', 'Vivian', 'Walter', 'Wendy', 'Weston', 'William', 'Willow', 'Winnie',
  'Winston', 'Wyatt', 'Xander', 'Xavier', 'Yara', 'Yasmine', 'Yolanda', 'Yuri',
  'Zach', 'Zachary', 'Zara', 'Zelda', 'Zion', 'Zoe', 'Zola', 'Adrian', 'Albert',
  'Alvin', 'Angela', 'Arnold', 'Ashley', 'Baron', 'Bella', 'Bernard', 'Beth',
  'Betty', 'Boris', 'Brandon', 'Brent', 'Brian', 'Brittany', 'Calvin', 'Candice',
  'Carla', 'Carmen', 'Carol', 'Caroline', 'Catherine', 'Cathy', 'Chester', 'Chris',
  'Christina', 'Chuck', 'Cindy', 'Clarence', 'Cody', 'Colin', 'Collin', 'Crystal',
  'Cynthia', 'Dale', 'Dana', 'Daniel', 'Darlene', 'David', 'Dawn', 'Dean', 'Deborah',
  'Dennis', 'Derek', 'Desmond', 'Diana', 'Diane', 'Don', 'Donna', 'Doris', 'Douglas',
  'Drew', 'Dylan', 'Earl', 'Eileen', 'Elaine', 'Elena', 'Elias', 'Elizabeth',
  'Ellen', 'Emily', 'Emma', 'Eric', 'Erica', 'Erik', 'Erin', 'Ernest', 'Eugene',
  'Eva', 'Evelyn', 'Faye', 'Felix', 'Flora', 'Florence', 'Frances', 'Francis',
  'Frank', 'Franklin', 'Frederick', 'Gabriel', 'Gary', 'Gene', 'George', 'Gerald',
  'Gilbert', 'Gloria', 'Grace', 'Gregory', 'Guy', 'Harold', 'Harry', 'Harvey',
  'Heather', 'Helen', 'Henry', 'Howard', 'Hugh', 'Ian', 'Irene', 'Iris', 'Jack',
  'Jacob', 'James', 'Jane', 'Janet', 'Janice', 'Jason', 'Jean', 'Jeff', 'Jeffrey',
  'Jenna', 'Jennifer', 'Jeremy', 'Jerry', 'Jesse', 'Jessica', 'Joan', 'Joanne',
  'Joe', 'John', 'Jonathan', 'Jordan', 'Joseph', 'Joshua', 'Joyce', 'Judith',
  'Judy', 'Julia', 'Julie', 'Justin', 'Karen', 'Karl', 'Katherine', 'Kathleen',
  'Kathryn', 'Kayla', 'Keith', 'Kelly', 'Ken', 'Kenneth', 'Kevin', 'Kim',
  'Kimberly', 'Larry', 'Laura', 'Lauren', 'Lawrence', 'Lena', 'Leonard', 'Leslie',
  'Lillian', 'Linda', 'Lisa', 'Lloyd', 'Logan', 'Louis', 'Lucas', 'Lucy', 'Lydia',
  'Mabel', 'Megan', 'Melissa', 'Michele', 'Michelle', 'Mildred', 'Molly', 'Monica',
  'Nancy', 'Natalie', 'Nathan', 'Nicholas', 'Nicole', 'Noah', 'Norma', 'Oliver',
  'Olivia', 'Oscar', 'Pamela', 'Patricia', 'Patrick', 'Paul', 'Paula', 'Peter',
  'Philip', 'Rachel', 'Ralph', 'Randy', 'Raymond', 'Rebecca', 'Richard', 'Robert',
  'Robin', 'Roger', 'Ronald', 'Rose', 'Roy', 'Ruby', 'Russell', 'Ruth', 'Ryan',
  'Samantha', 'Samuel', 'Sandra', 'Sara', 'Sarah', 'Scott', 'Sean', 'Sharon',
  'Shawn', 'Shirley', 'Simon', 'Sophia', 'Stephanie', 'Steven', 'Susan', 'Teresa',
  'Terry', 'Theresa', 'Thomas', 'Timothy', 'Tina', 'Todd', 'Tracy', 'Troy', 'Tyler',
  'Valerie', 'Victor', 'Victoria', 'Virginia', 'Walter', 'Wayne', 'Wendy', 'William',
  'Willie', 'Zoe',
];

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getDisplayName(userId, postId) {
  const h = hashCode(userId + ':' + postId);
  return NAMES[h % NAMES.length];
}

function getPostAuthorName(postId) {
  return getDisplayName(CURRENT_USER_ID, postId);
}

export {
  genId,
  formatCount,
  formatEventTime,
  formatTimeAgo,
  loadJSON,
  saveJSON,
  getUserId,
  CURRENT_USER_ID,
  NAMES,
  hashCode,
  getDisplayName,
  getPostAuthorName,
};