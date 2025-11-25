import supabase from '../lib/_supabaseClient.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  // Get ALL performance history records for this user to calculate averages
  const { data: allHistoryData, error: historyError } = await supabase
    .from('performance_history')
    .select('stats, recorded_at')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: true });

  if (historyError) {
    console.error('Error fetching performance history:', historyError);
    return res.status(500).json({ error: historyError.message });
  }

  // If no history exists, return empty stats structure
  if (!allHistoryData || allHistoryData.length === 0) {
    const emptyStats = {};
    for (let char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      emptyStats[char] = { streak: 0, correct: 0, mastery: 0, attempts: 0 };
    }
    return res.status(200).json({ data: { stats: emptyStats } });
  }

  // Initialize accumulator for each letter
  const letterAccumulators = {};
  for (let char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    letterAccumulators[char] = {
      attempts: 0,
      mastery: 0,
      correct: 0,
      streak: 0,
      count: 0
    };
  }

  // Sum up all values from all history records
  allHistoryData.forEach(record => {
    if (!record.stats) return;
    
    const stats = typeof record.stats === 'string' 
      ? JSON.parse(record.stats) 
      : record.stats;

    for (let char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      if (stats[char]) {
        const letterData = stats[char];
        letterAccumulators[char].attempts += Number(letterData.attempts) || 0;
        letterAccumulators[char].mastery += Number(letterData.mastery) || 0;
        letterAccumulators[char].correct += Number(letterData.correct) || 0;
        letterAccumulators[char].streak += Number(letterData.streak) || 0;
        letterAccumulators[char].count += 1;
      }
    }
  });

  // Calculate averages for each letter
  const averagedStats = {};
  const totalRecordCount = allHistoryData.length;

  for (let char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const acc = letterAccumulators[char];
    // Use the actual count of records that have this letter
    // If count is 0, it means this letter never appeared, so average is 0
    const count = acc.count;
    
    if (count === 0) {
      averagedStats[char] = {
        attempts: 0,
        mastery: 0,
        correct: 0,
        streak: 0
      };
    } else {
      // Calculate exact averages (no rounding) - frontend can format as needed
      averagedStats[char] = {
        attempts: acc.attempts / count,
        mastery: acc.mastery / count,
        correct: acc.correct / count,
        streak: acc.streak / count
      };
    }
  }

  // Debug logging to verify calculation
  if (letterAccumulators['A'].count > 0) {
    console.log('Average calculation for Letter A:', {
      totalRecords: totalRecordCount,
      recordsWithA: letterAccumulators['A'].count,
      totalMastery: letterAccumulators['A'].mastery,
      averageMastery: averagedStats['A'].mastery
    });
  }

  return res.status(200).json({ data: { stats: averagedStats } });
}
