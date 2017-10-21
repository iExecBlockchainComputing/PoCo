#include <iostream>
#include <unordered_map>
#include <unordered_set>

double Cr(uint64_t user)
{
	switch (user)
	{
		case 1:  return 0.800;
	  case 2:  return 0.967;
	  case 6:  return 0.967;
	  case 7:  return 0.998;
	  case 8:  return 0.933;
	  case 9:  return 0.999;
		default: return 0.800;
	}
}


template<typename R, typename U>
class SarmentaVote
{
	public:
		bool                         addVote(const R& result, const U& user) { return m_votes[result].insert(user).second; }
		std::unordered_set<U>&       getVote(const R& result)                { return m_votes[result];                     }
		const std::unordered_set<U>& getVote(const R& result) const          { return m_votes[result];                     }
	// private:
		std::unordered_map<R, std::unordered_set<U>> m_votes;
};


int main()
{
	SarmentaVote<char, uint64_t> S;

	S.addVote('Z', 6);
	S.addVote('Z', 7);
	S.addVote('M', 8);

	double P_AllBad = 1.0;
	std::unordered_map<char, double> PG_Good;
	std::unordered_map<char, double> PG_Bad;
	std::unordered_map<char, double> PG_OtherBad;

	for (const auto& [result, users] : S.m_votes)
	{
		double good = 1.0, bad = 1.0;
		for (const auto& user: users)
		{
			double cr = Cr(user);
			good *= cr;
			bad  *= 1-cr;
		}
		PG_Good[result] = good;
		PG_Bad [result] = bad;
		P_AllBad       *= bad;
	}
	double refactor = P_AllBad;
	for (const auto& [result, _] : S.m_votes)
	{
		PG_OtherBad[result] = P_AllBad / PG_Bad[result];
		refactor           += PG_Good[result]*PG_OtherBad[result];
	}

	for (const auto& [result, _] : S.m_votes)
	{
		double metric = PG_Good[result]*PG_OtherBad[result]/refactor;
		printf("%c: %f\n", result, metric);
	}



	return 0;
}
