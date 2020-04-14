#!/usr/bin/python

import itertools
import json
import requests

URL       = 'https://api.thegraph.com/subgraphs/name/{}'
HEADERS   = {'Content-Type': 'application/json'}
QUERY     = """
query tasks($first: Int, $skip: Int)
{
	accurateContributions(first: $first, skip: $skip, where: { score_gt: 0 }, orderBy: timestamp, orderDirection: desc) {
		contribution {
			worker {
				id
			}
		}
	}
}
"""

def execute(subgraph, query, **kwargs):
	return requests.post(URL.format(subgraph), headers=HEADERS, data=json.dumps({ 'query': query, 'variables': kwargs })).json()

if __name__ == '__main__':
	size = 1000
	list = set()

	for i in itertools.count(0, size):
		result = execute('iexecblockchaincomputing/iexec-poco-v3', QUERY, first=size, skip=i)

		for entry in result['data']['accurateContributions']:
			list.add(entry['contribution']['worker']['id'])

		if len(result['data']['accurateContributions']) < size:
			break

	for worker in list:
		print(worker)
