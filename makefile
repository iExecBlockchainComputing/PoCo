# MINIFICATION
JQN       = jqn
PATH_MAIN = ./build/contracts/
PATH_MIN  = ./build/contracts-min/
OBJECTS   = $(patsubst $(PATH_MAIN)%.json, %, $(wildcard $(PATH_MAIN)*.json))

.PHONY: minify

all:
	@echo "Usage: make [minify]"

minify: $(OBJECTS)

$(OBJECTS): % : $(PATH_MAIN)%.json makefile
	@mkdir -p $(PATH_MIN)
	@echo -n "Minification of $@.json ..."
	@cat $< | $(JQN) 'pick(["abi","networks"])' --color=false -j > $(PATH_MIN)/$@.json
	@echo " done"
