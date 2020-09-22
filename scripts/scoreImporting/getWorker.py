#!/usr/bin/python

# Copyright 2020 IEXEC BLOCKCHAIN TECH
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

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
